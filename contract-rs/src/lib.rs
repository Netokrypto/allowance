use near_sdk::store::LookupMap;
use near_sdk::{env, near, AccountId, PanicOnDefault, PublicKey};

const OPEN_DEPOSIT: u128 = 20_000_000_000_000_000_000_000;
const PER_CALL_CAP: u128 = 50_000;
const DAILY_CAP: u128 = 100_000;
const TREASURY: u128 = 1_000_000;

#[near(serializers = [json, borsh])]
#[derive(Clone)]
pub struct Desk {
    pub per_call_cap: u128,
    pub daily_cap: u128,
    pub spent_today: u128,
    pub day: u64,
    pub paused: bool,
    pub allowlist: Vec<String>,
    pub quote_receiver: String,
    pub quote_amount: u128,
    pub quote_expires_at: u64,
    pub treasury: u128,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    agent_pk: PublicKey,
    desks: LookupMap<AccountId, Desk>,
}

#[near]
impl Contract {
    #[init]
    pub fn new(agent_public_key: String) -> Self {
        let agent_pk = agent_public_key
            .parse()
            .unwrap_or_else(|_| env::panic_str("bad_key"));
        Self {
            agent_pk,
            desks: LookupMap::new(b"d".to_vec()),
        }
    }

    pub fn agent_public_key(&self) -> String {
        self.agent_pk.to_string()
    }

    pub fn get_desk(&self, owner: AccountId) -> Option<Desk> {
        self.desks.get(&owner).cloned()
    }

    #[payable]
    pub fn open_desk(&mut self) {
        let attached = env::attached_deposit().as_yoctonear();
        if attached < OPEN_DEPOSIT {
            env::panic_str("need_storage");
        }
        let owner = env::predecessor_account_id();
        if self.desks.contains_key(&owner) {
            env::panic_str("desk_exists");
        }
        self.desks.insert(
            owner,
            Desk {
                per_call_cap: PER_CALL_CAP,
                daily_cap: DAILY_CAP,
                spent_today: 0,
                day: epoch_day(),
                paused: false,
                allowlist: vec!["market-data.near".to_string()],
                quote_receiver: String::new(),
                quote_amount: 0,
                quote_expires_at: 0,
                treasury: TREASURY,
            },
        );
    }

    pub fn pause(&mut self, paused: bool) {
        let owner = env::predecessor_account_id();
        let desk = self.desk_mut(&owner);
        desk.paused = paused;
    }

    pub fn record_quote(&mut self, deposit_address: String, amount: String, expires_at: String) {
        let owner = env::predecessor_account_id();
        let receiver = clean_receiver(&deposit_address);
        let value = parse_amount(&amount);
        let expires = parse_millis(&expires_at);
        if expires <= now_ms() {
            env::panic_str("quote_expired");
        }
        let desk = self.desk_mut(&owner);
        desk.quote_receiver = receiver;
        desk.quote_amount = value;
        desk.quote_expires_at = expires;
    }

    pub fn withdraw(&mut self, receiver: String, amount: String) {
        let _receiver = clean_receiver(&receiver);
        let value = parse_amount(&amount);
        let owner = env::predecessor_account_id();
        let desk = self.desk_mut(&owner);
        if value > desk.treasury {
            env::panic_str("insufficient_treasury");
        }
        desk.treasury -= value;
    }

    pub fn execute(&mut self, owner: AccountId, kind: String, receiver: String, amount: String) -> String {
        if env::signer_account_pk() != self.agent_pk {
            env::panic_str("not_agent");
        }
        let value = parse_amount(&amount);
        let receiver = clean_receiver(&receiver);
        if kind != "pay" && kind != "settle" {
            env::panic_str("bad_kind");
        }
        let Some(mut desk) = self.desks.get(&owner).cloned() else {
            env::panic_str("not_owner");
        };
        if desk.paused {
            env::panic_str("paused");
        }
        let today = epoch_day();
        if desk.day != today {
            desk.day = today;
            desk.spent_today = 0;
        }
        if kind == "pay" {
            if !desk.allowlist.iter().any(|item| item == &receiver) {
                env::panic_str("receiver_not_allowlisted");
            }
        } else if desk.quote_receiver.is_empty() {
            env::panic_str("quote_missing");
        } else if desk.quote_expires_at <= now_ms() {
            env::panic_str("quote_expired");
        } else if receiver != desk.quote_receiver || value != desk.quote_amount {
            env::panic_str("quote_mismatch");
        }
        if value > desk.per_call_cap {
            env::panic_str("over_per_call_cap");
        }
        if desk.spent_today + value > desk.daily_cap {
            env::panic_str("over_daily_cap");
        }
        if value > desk.treasury {
            env::panic_str("insufficient_treasury");
        }
        desk.spent_today += value;
        desk.treasury -= value;
        if kind == "settle" {
            desk.quote_receiver.clear();
            desk.quote_amount = 0;
            desk.quote_expires_at = 0;
        }
        self.desks.insert(owner, desk);
        "allowed".to_string()
    }
}

impl Contract {
    fn desk_mut(&mut self, owner: &AccountId) -> &mut Desk {
        if !self.desks.contains_key(owner) {
            env::panic_str("not_owner");
        }
        self.desks.get_mut(owner).unwrap()
    }
}

fn epoch_day() -> u64 {
    env::block_timestamp() / 86_400_000_000_000
}

fn now_ms() -> u64 {
    env::block_timestamp() / 1_000_000
}

fn parse_millis(value: &str) -> u64 {
    let parsed = parse_amount(value);
    u64::try_from(parsed).unwrap_or_else(|_| env::panic_str("amount_not_positive"))
}

fn parse_amount(value: &str) -> u128 {
    if value.is_empty() || !value.bytes().all(|byte| byte.is_ascii_digit()) {
        env::panic_str("amount_not_positive");
    }
    let parsed = value.parse::<u128>().unwrap_or_else(|_| env::panic_str("amount_not_positive"));
    if parsed == 0 {
        env::panic_str("amount_not_positive");
    }
    parsed
}

fn clean_receiver(value: &str) -> String {
    let receiver = value.trim().to_lowercase();
    let ok = (2..=64).contains(&receiver.len())
        && receiver
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '.' | '_' | '-'));
    if !ok {
        env::panic_str("bad_receiver");
    }
    receiver
}

#[allow(dead_code)]
const REASONS: [&str; 15] = [
    "allowed",
    "paused",
    "not_agent",
    "not_owner",
    "receiver_not_allowlisted",
    "amount_not_positive",
    "over_per_call_cap",
    "over_daily_cap",
    "quote_mismatch",
    "quote_expired",
    "quote_missing",
    "bad_kind",
    "bad_receiver",
    "insufficient_treasury",
    "unknown_method",
];
