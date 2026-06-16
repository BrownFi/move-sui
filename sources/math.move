module brownfi_amm::math;

const EOverflow: u64 = 0;
const EDivisionByZero: u64 = 1;

const MAX_U64: u128 = 18446744073709551615;
const MAX_U64_U256: u256 = 18446744073709551615;
const Q32: u128 = 4294967296; // 1 << 32 (reduced from Q64 to prevent overflow)

/// Calculates (a * b) / c with overflow protection.
public fun mul_div(a: u64, b: u64, c: u64): u64 {
    assert!(c != 0, EDivisionByZero);
    let result = ((a as u128) * (b as u128)) / (c as u128);
    assert!(result <= MAX_U64, EOverflow);
    (result as u64)
}

/// Calculates (a * b) / c with u128 inputs for high precision
public fun mul_div_u128(a: u128, b: u128, c: u128): u128 {
    assert!(c != 0, EDivisionByZero);
    // For extremely large numbers, we'd need u256, but for now use u128
    // This matches Solidity's FullMath behavior within u128 range
    (a * b) / c
}

/// Calculates floor((a * b) / c). Use when rounding must be explicit.
public fun mul_div_down_u128(a: u128, b: u128, c: u128): u128 {
    assert!(c != 0, EDivisionByZero);
    (a * b) / c
}

/// Calculates ceil((a * b) / c). Use for pool-favoring required input/penalty math.
public fun mul_div_up_u128(a: u128, b: u128, c: u128): u128 {
    assert!(c != 0, EDivisionByZero);
    let product = a * b;
    if (product == 0) 0 else ((product - 1) / c) + 1
}

public fun mul_div_down_u256(a: u256, b: u256, c: u256): u256 {
    assert!(c != 0, EDivisionByZero);
    (a * b) / c
}

public fun mul_div_up_u256(a: u256, b: u256, c: u256): u256 {
    assert!(c != 0, EDivisionByZero);
    let product = a * b;
    if (product == 0) 0 else ((product - 1) / c) + 1
}

public fun mul_div_down_to_u64(a: u128, b: u128, c: u128): u64 {
    let result = mul_div_down_u128(a, b, c);
    assert!(result <= MAX_U64, EOverflow);
    (result as u64)
}

public fun mul_div_up_to_u64(a: u128, b: u128, c: u128): u64 {
    let result = mul_div_up_u128(a, b, c);
    assert!(result <= MAX_U64, EOverflow);
    (result as u64)
}

public fun u256_to_u64_checked(value: u256): u64 {
    assert!(value <= MAX_U64_U256, EOverflow);
    (value as u64)
}

/// Converts trader-paid input into BrownFi v3 no-fee pseudo input.
public fun pseudo_in_from_actual_u128(actual_in: u128, fee: u32, precision: u128): u128 {
    assert!(precision != 0, EDivisionByZero);
    mul_div_down_u128(actual_in, precision, precision + (fee as u128))
}

/// Calculates the BrownFi v3 fee amount from no-fee pseudo input.
public fun fee_from_pseudo_input_u128(pseudo_in: u128, fee: u32, precision: u128): u128 {
    assert!(precision != 0, EDivisionByZero);
    mul_div_down_u128(pseudo_in, (fee as u128), precision)
}

/// Calculates (a * b) / c and returns u64 with overflow check
public fun mul_div_u128_to_u64(a: u128, b: u128, c: u128): u64 {
    assert!(c != 0, EDivisionByZero);
    let result = (a * b) / c;
    assert!(result <= MAX_U64, EOverflow);
    (result as u64)
}

/// Calculates ceil_div((a * b), c) with overflow protection.
public fun ceil_mul_div(a: u64, b: u64, c: u64): u64 {
    assert!(c != 0, EDivisionByZero);
    let product = (a as u128) * (b as u128);
    let result = ceil_div_u128(product, (c as u128));
    assert!(result <= MAX_U64, EOverflow);
    (result as u64)
}

/// Calculates sqrt(a * b) with overflow protection.
public fun mul_sqrt(a: u64, b: u64): u64 {
    let product = (a as u128) * (b as u128);
    let result = sqrt_u128(product);
    assert!(result <= MAX_U64, EOverflow);
    (result as u64)
}

/// Calculates ceil(a / b).
public fun ceil_div_u128(a: u128, b: u128): u128 {
    assert!(b != 0, EDivisionByZero);
    if (a == 0) 0 else (a - 1) / b + 1
}

/// Convert amount from token decimals to standard decimals (e.g., 9)
/// If token has 6 decimals and standard is 9: multiply by 1000
/// If token has 12 decimals and standard is 9: divide by 1000
public fun parse_amount_to_standard_decimals(
    token_decimals: u8,
    amount: u64,
    standard_decimals: u8
): u64 {
    if (token_decimals > standard_decimals) {
        let diff = token_decimals - standard_decimals;
        amount / pow_10(diff)
    } else if (token_decimals < standard_decimals) {
        let diff = standard_decimals - token_decimals;
        let result = (amount as u128) * (pow_10(diff) as u128);
        assert!(result <= MAX_U64, EOverflow);
        (result as u64)
    } else {
        amount
    }
}

public fun parse_amount_from_standard_decimals(
    token_decimals: u8,
    amount: u64,
    standard_decimals: u8
): u64 {
    if (token_decimals > standard_decimals) {
        let diff = token_decimals - standard_decimals;
        let result = (amount as u128) * (pow_10(diff) as u128);
        assert!(result <= MAX_U64, EOverflow);
        (result as u64)
    } else if (token_decimals < standard_decimals) {
        let diff = standard_decimals - token_decimals;
        amount / pow_10(diff)
    } else {
        amount
    }
}

public fun parse_amount_from_standard_decimals_up(
    token_decimals: u8,
    amount: u64,
    standard_decimals: u8
): u64 {
    if (token_decimals > standard_decimals) {
        let diff = token_decimals - standard_decimals;
        let result = (amount as u128) * (pow_10(diff) as u128);
        assert!(result <= MAX_U64, EOverflow);
        (result as u64)
    } else if (token_decimals < standard_decimals) {
        let diff = standard_decimals - token_decimals;
        let result = ceil_div_u128((amount as u128), (pow_10(diff) as u128));
        assert!(result <= MAX_U64, EOverflow);
        (result as u64)
    } else {
        amount
    }
}


/// Calculate 10^n for small exponents (up to 18)
public fun pow_10(n: u8): u64 {
    if (n == 0) return 1;
    if (n == 1) return 10;
    if (n == 2) return 100;
    if (n == 3) return 1000;
    if (n == 4) return 10000;
    if (n == 5) return 100000;
    if (n == 6) return 1000000;
    if (n == 7) return 10000000;
    if (n == 8) return 100000000;
    if (n == 9) return 1000000000;
    if (n == 10) return 10000000000;
    if (n == 11) return 100000000000;
    if (n == 12) return 1000000000000;
    if (n == 13) return 10000000000000;
    if (n == 14) return 100000000000000;
    if (n == 15) return 1000000000000000;
    if (n == 16) return 10000000000000000;
    if (n == 17) return 100000000000000000;
    if (n == 18) return 1000000000000000000;
    abort EOverflow
}

/// Get Q32 constant
public fun q32(): u64 {
    (Q32 as u64)
}

/// Absolute difference between two u64 values
public fun abs_diff(a: u64, b: u64): u64 {
    if (a >= b) {
        a - b
    } else {
        b - a
    }
}

/// Absolute difference between two u128 values
public fun abs_diff_u128(a: u128, b: u128): u128 {
    if (a >= b) {
        a - b
    } else {
        b - a
    }
}

/// Minimum of two u128 values
public fun min_u128(a: u128, b: u128): u128 {
    if (a < b) a else b
}

public fun sqrt_up_u256(x: u256): u256 {
    let root = sqrt_u256(x);
    if (root * root < x) root + 1 else root
}

/// Integer square root for u128 (Newton's method)
fun sqrt_u128(x: u128): u128 {
    if (x == 0) return 0;
    let mut z = x;
    let mut y = (z + 1) / 2;
    while (y < z) {
        z = y;
        y = (z + x / z) / 2;
    };
    z
}

fun sqrt_u256(x: u256): u256 {
    if (x == 0) return 0;
    let mut z = x;
    let mut y = x / 2 + 1;
    while (y < z) {
        z = y;
        y = (z + x / z) / 2;
    };
    z
}
