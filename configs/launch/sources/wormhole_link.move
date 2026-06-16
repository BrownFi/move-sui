module brownfi_amm::wormhole_link;

use wormhole::state::{Self, State};

/// Launch-only shim that forces Sui publish to include the direct Wormhole dependency.
public fun message_fee(state: &State): u64 {
    state::message_fee(state)
}
