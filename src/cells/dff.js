"use strict";

import joint from 'jointjs';
import bigInt from 'big-integer';
import * as help from '@app/help.js';

// D flip-flops
joint.shapes.digital.Gate.define('digital.Dff', {
}, {
    constructor: function(args) {
        _.defaults(args, { bits: 1, polarity: {} });
        if ('arst' in args.polarity && !args.arst_value)
            args.arst_value = 0;
        const markup = [];
        markup.push('<g class="rotatable">');
        markup.push(this.addWire(args, 'right', 0.5, { id: 'out', dir: 'out', bits: args.bits }));
        let num = 0;
        markup.push(this.addWire(args, 'left', (num++*16)+12, { id: 'in', dir: 'in', bits: args.bits }));
        if ('clock' in args.polarity)
            markup.push(this.addWire(args, 'left', (num++*16)+12, { id: 'clk', dir: 'in', bits: 1 }));
        if ('arst' in args.polarity)
            markup.push(this.addWire(args, 'left', (num++*16)+12, { id: 'arst', dir: 'in', bits: 1 }));
        if ('enable' in args.polarity)
            markup.push(this.addWire(args, 'left', (num++*16)+12, { id: 'en', dir: 'in', bits: 1 }));
        markup.push('<g class="scalable"><rect class="body"/></g><text class="label"/>');
        markup.push('</g>');
        this.markup = markup.join('');
        const size = { width: 80, height: num*16+8 };
        args.size = size;
        _.set(args, ['attrs', '.body'], size);
        joint.shapes.digital.Gate.prototype.constructor.apply(this, arguments);
        this.last_clk = 0;
    },
    operation: function(data) {
        const polarity = this.get('polarity');
        const pol = what => polarity[what] ? 1 : -1
        if ('enable' in polarity && data.en[0] != pol('enable'))
            return this.get('outputSignals');
        if ('arst' in polarity && data.arst[0] == pol('arst'))
            return { out: help.bigint2sig(bigInt(this.get('arst_value')), this.get('bits')) };
        if ('clock' in polarity) {
            const last_clk = this.last_clk;
            this.last_clk = data.clk[0];
            if (data.clk[0] == pol('clock') && last_clk == -pol('clock'))
                return { out: data.in };
            else
                return this.get('outputSignals');
        } else return { out: data.in };
    }
});

