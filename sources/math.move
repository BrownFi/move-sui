module brownfi_amm::math;

const EOverflow: u64 = 0;
const EDivisionByZero: u64 = 1;

const MAX_U64: u128 = 18446744073709551615;

/// Calculates (a * b) / c with overflow protection.
public fun mul_div(a: u64, b: u64, c: u64): u64 {
    assert!(c != 0, EDivisionByZero);
    let result = ((a as u128) * (b as u128)) / (c as u128);
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
    let result = std::u128::sqrt(product);
    assert!(result <= MAX_U64, EOverflow);
    (result as u64)
}

/// Calculates ceil(a / b).
public fun ceil_div_u128(a: u128, b: u128): u128 {
    assert!(b != 0, EDivisionByZero);
    if (a == 0) 0 else (a - 1) / b + 1
}