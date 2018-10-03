"use strict";

import bigInt from 'big-integer';
import { Vector3vl } from '3vl';

export function validNumber(str, base) {
    const binary_re = /^[01x]+$/;
    const oct_re = /^[0-7x]+$/;
    const hex_re = /^[0-9a-fx]+$/;
    const dec_re = /^([0-9]+|x)$/;
    const re =
        base == 'bin' ? binary_re :
        base == 'oct' ? oct_re :
        base == 'hex' ? hex_re : 
        base == 'dec' ? dec_re : /^$/;
    return re.test(str);
}

export function base2sig(str, bits, base) {
    switch(base) {
        case 'bin': return Vector3vl.fromBin(str, bits);
        case 'oct': return Vector3vl.fromOct(str, bits);
        case 'hex': return Vector3vl.fromHex(str, bits);
        case 'dec': 
            if (str == 'x') return Vector3vl.xes(bits);
            return bigint2sig(bigInt(str), bits);
    }
}

export function sig2base(sig, base) {
    switch(base) {
        case 'bin': return sig.toBin();
        case 'oct': return sig.toOct();
        case 'hex': return sig.toHex();
        case 'dec': 
            if (!sig.isFullyDefined) return 'x';
            return sig2bigint(sig).toString();
    }
}

export function bigint2sig(i, bits) {
    const j = i.isNegative() ? bigInt.one.shiftLeft(Math.max(i.bitLength().toJSNumber()+2, bits)).plus(i) : i;
    return Vector3vl.fromArray(j.toArray(2).value
        .reverse()
        .map(x => (x<<1)-1)
        .concat(Array(bits).fill(-1))
        .slice(0, bits));
}

export function sig2bigint(sig, signed) {
    const sign = signed && sig.get(sig.bits - 1) == 1;
    const j = bigInt.fromArray(sig.toArray().slice().reverse().map(x => (x+1)>>1), 2);
    return sign ? j.minus(bigInt.one.shiftLeft(sig.bits)) : j;
}

