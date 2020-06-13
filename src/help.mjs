"use strict";

import bigInt from 'big-integer';
import { Vector3vl, Display3vlWithRegex, Display3vl } from '3vl';

export const display3vl = new Display3vl();

class Display3vlDec extends Display3vlWithRegex {
    constructor() {
        super('[0-9]*|x');
    }
    get name() {
        return "dec";
    }
    get sort() {
        return 0;
    }
    can(kind, bits) {
        return true;
    }
    read(data, bits) {
        if (data == 'x') return Vector3vl.xes(bits);
        return bigint2sig(bigInt(data), bits);
    }
    show(data) {
        if (!data.isFullyDefined) return 'x';
        return sig2bigint(data).toString();
    }
    size(bits) {
        return Math.ceil(bits / Math.log2(10))
    }
};

display3vl.addDisplay(new Display3vlDec());
        
export function baseSelectMarkupHTML(bits, base) { 
    const markup = display3vl.usableDisplays('read', bits)
        .map(n => '<option value="' + n + '"' + (n == base ? ' selected="selected"' : '') +'>' + n + '</option>');
    return '<select name="base">' + markup.join("") + '</select>';
};

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

