"use strict";

import bigInt from 'big-integer';

export function validNumber(str, base) {
    const binary_re = /^[01x]+$/;
    const oct_re = /^[0-7x]+$/;
    const hex_re = /^[0-9a-fx]+$/;
    const re =
        base == 'bin' ? binary_re :
        base == 'oct' ? oct_re :
        base == 'hex' ? hex_re : /^$/;
    return re.test(str);
}

function mk_num2sig(bw) {
    const num2sig_map = {x: Array(bw).fill(0)};
    for (const x of Array(1 << bw).keys()) {
        num2sig_map[x.toString(36)] = bigint2sig(bigInt(x), bw);
    }
    Object.freeze(num2sig_map);

    return (str, bits) => [].concat(...str.split('').reverse().map(x => num2sig_map[x]))
        .concat(Array(Math.max(0, bits - str.length * bw)).fill(str[0] == 'x' ? 0 : -1))
        .slice(0, bits);
}

export const binary2sig = mk_num2sig(1);
export const oct2sig = mk_num2sig(3);
export const hex2sig = mk_num2sig(4);

export function base2sig(str, bits, base) {
    switch(base) {
        case 'bin': return binary2sig(str, bits);
        case 'oct': return oct2sig(str, bits);
        case 'hex': return hex2sig(str, bits);
    }
}

export function isLive(sig) {
    return sig.every(x => x > 0);
}

export function isLow(sig) {
    return sig.every(x => x < 0);
}

export function isDefined(sig) {
    return sig.some(x => x != 0);
}

export function sigClass(sig) {
    if (isLive(sig)) return 'live';
    else if (isLow(sig)) return 'low';
    else if (isDefined(sig)) return 'defined';
    else return '';
}

function mk_sig2num(bw) {
    return sig => {
        const csig = sig.slice();
        const sg = [];
        while (csig.length > 0) sg.push(csig.splice(0, bw));
        sg.reverse();
        while (sg[0].length < bw) sg[0].push(-1);
        return sg
            .map(l => l.some(x => x == 0) ? 'x' : l.reduceRight((a, b) => (a << 1) + ((b + 1) >> 1), 0).toString(36))
            .join('');
    }
}

export const sig2binary = mk_sig2num(1);
export const sig2oct = mk_sig2num(3);
export const sig2hex = mk_sig2num(4);

export function sig2base(sig, base) {
    switch(base) {
        case 'bin': return sig2binary(sig);
        case 'oct': return sig2oct(sig);
        case 'hex': return sig2hex(sig);
    }
}

export function bigint2sig(i, bits) {
    const j = i.isNegative() ? bigInt.one.shiftLeft(bits).plus(i) : i;
    return j.toArray(2).value
        .reverse()
        .map(x => (x<<1)-1)
        .concat(Array(bits).fill(-1))
        .slice(0, bits);
}

export function sig2bigint(sig, signed) {
    const sign = signed && sig.slice(-1)[0] == 1;
    const j = bigInt.fromArray(sig.slice().reverse().map(x => (x+1)>>1), 2);
    return sign ? j.minus(bigInt.one.shiftLeft(sig.length)) : j;
}

