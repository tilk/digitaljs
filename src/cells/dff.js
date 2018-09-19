"use strict";

import joint from 'jointjs';
import bigInt from 'big-integer';
import * as help from '@app/help.js';
import { Vector3vl } from '3vl';

// D flip-flops
joint.shapes.digital.Box.define('digital.Dff', {
}, {
    constructor: function(args) {
        _.defaults(args, { bits: 1, polarity: {} });
        if ('arst' in args.polarity && !args.arst_value)
            args.arst_value = Array(args.bits).fill('0').join('');
        const markup = [];
        const lblmarkup = [];
        markup.push(this.addLabelledWire(args, lblmarkup, 'right', 0.5, { id: 'out', dir: 'out', bits: args.bits, label: 'Q' }));
        let num = 0;
        markup.push(this.addLabelledWire(args, lblmarkup, 'left', (num++*16)+12, { id: 'in', dir: 'in', bits: args.bits, label: 'D' }));
        if ('clock' in args.polarity)
            markup.push(this.addLabelledWire(args, lblmarkup, 'left', (num++*16)+12, { id: 'clk', dir: 'in', bits: 1, polarity: args.polarity.clock, clock: true }));
        if ('arst' in args.polarity)
            markup.push(this.addLabelledWire(args, lblmarkup, 'left', (num++*16)+12, { id: 'arst', dir: 'in', bits: 1, polarity: args.polarity.arst }));
        if ('enable' in args.polarity)
            markup.push(this.addLabelledWire(args, lblmarkup, 'left', (num++*16)+12, { id: 'en', dir: 'in', bits: 1, polarity: args.polarity.enable }));
        markup.push('<rect class="body"/><text class="label"/>');
        markup.push(lblmarkup.join(''));
        this.markup = markup.join('');
        const size = { width: 80, height: num*16+8 };
        args.size = size;
        joint.shapes.digital.Gate.prototype.constructor.apply(this, arguments);
        this.last_clk = 0;
    },
    operation: function(data) {
        const polarity = this.get('polarity');
        const pol = what => polarity[what] ? 1 : -1
        if ('enable' in polarity && data.en.get(0) != pol('enable'))
            return this.get('outputSignals');
        if ('arst' in polarity && data.arst.get(0) == pol('arst'))
            return { out: Vector3vl.fromBin(this.get('arst_value'), this.get('bits')) };
        if ('clock' in polarity) {
            const last_clk = this.last_clk;
            this.last_clk = data.clk.get(0);
            if (data.clk.get(0) == pol('clock') && last_clk == -pol('clock'))
                return { out: data.in };
            else
                return this.get('outputSignals');
        } else return { out: data.in };
    },
    gateParams: joint.shapes.digital.Gate.prototype.gateParams.concat(['polarity', 'bits'])
});
joint.shapes.digital.DffView = joint.shapes.digital.BoxView;

