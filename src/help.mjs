"use strict";

import bigInt from 'big-integer';
import { Vector3vl, Display3vlWithRegex, Display3vl } from '3vl';

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

class Display3vlDec2c extends Display3vlWithRegex {
    constructor() {
        super('-?[0-9]*|x');
    }
    get name() {
        return "dec2c";
    }
    get sort() {
        return 0;
    }
    can(kind, bits) {
        return bits > 0;
    }
    read(data, bits) {
        if (data == 'x') return Vector3vl.xes(bits);
        return bigint2sig(bigInt(data), bits);
    }
    show(data) {
        if (!data.isFullyDefined) return 'x';
        return sig2bigint(data, true).toString();
    }
    size(bits) {
        return 1 + Math.ceil(bits / Math.log2(10))
    }
};

const controlCodes20 = [
    'NUL', 'SOH', 'STX', 'ETX', 'EOT', 'ENQ', 'ACK', 'BEL', 
    'BS',  'HT',  'LF',  'VT',  'FF',  'CR',  'SO',  'SI', 
    'DLE', 'DC1', 'DC2', 'DC3', 'DC4', 'NAK', 'SYN', 'ETB',
    'CAN', 'EM',  'SUB', 'ESC', 'FS',  'GS',  'RS',  'US',
    'SP',  'DEL'];

export class Display3vlASCII extends Display3vlWithRegex {
    constructor() {
        super('[\x20-\x7e\xa0-\xff\ufffd\u2400-\u2421]|' + controlCodes20.join('|'))
    }
    get name() {
        return "ascii";
    }
    get sort() {
        return 1;
    }
    can(kind, bits) {
        return bits == 7 || bits == 8;
    }
    read(data, bits) {
        if (data.length == 1) {
            const code = data.charCodeAt(0);
            if (code == 0xfffd) return Vector3vl.xes(bits);
            if (code == 0x2421) return Vector3vl.fromHex("7f", bits);
            if (code >= 0x2400 && code <= 0x2420) 
                return Vector3vl.fromHex((code - 0x2400).toString(16), bits);
            return Vector3vl.fromHex(code.toString(16), bits);
        } else {
            const code = controlCodes20.indexOf(data);
            if (code < 0) return Vector3vl.xes(bits);
            if (code == 0x21) return Vector3vl.fromHex("7f", bits);
            return Vector3vl.fromHex(code.toString(16), bits);
        }
    }
    show(data) {
        if (!data.isFullyDefined) return "\ufffd";
        const code = parseInt(data.toHex(), 16);
        if (code <= 0x20) {
            return String.fromCharCode(0x2400 + code);
        }
        if (code == 0x7f) return "\u2421";
        if (code > 0x7f && code < 0xa0) {
            return "\ufffd";
        }
        return String.fromCharCode(code);
    }
    size(bits) {
        return 1;
    }
}

        
export function baseSelectMarkupHTML(display3vl, bits, base) { 
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

