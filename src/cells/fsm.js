"use strict";

import $ from 'jquery';
import _ from 'lodash';
import * as joint from 'jointjs';
import { Box, BoxView } from './base';
import bigInt from 'big-integer';
import * as help from '../help.js';
import { Vector3vl, Mem3vl } from '3vl';

export const FSM = Box.define('FSM', {
    size: { width: 80, height: 3*16+8 }
}, {
    constructor: function(args) {
        if (!args.init_state) args.init_state = 0;
        if (!('current_state' in args)) args.current_state = args.init_state;
        const markup = [];
        const lblmarkup = [];
        markup.push(this.addLabelledWire(args, lblmarkup, 'left', 16+12, { id: 'clk', dir: 'in', bits: 1, polarity: args.polarity.clock, clock: true }));
        markup.push(this.addLabelledWire(args, lblmarkup, 'left', 2*16+12, { id: 'arst', dir: 'in', bits: 1, polarity: args.polarity.arst }));
        markup.push(this.addLabelledWire(args, lblmarkup, 'left', 12, { id: 'in', dir: 'in', bits: args.bits.in }));
        markup.push(this.addLabelledWire(args, lblmarkup, 'right', 12, { id: 'out', dir: 'out', bits: args.bits.out }));
        markup.push('<rect class="body"/><text class="label"/>');
        markup.push(lblmarkup.join(''));
        this.markup = markup.join('');
        this.fsmgraph = new joint.dia.Graph;
        const statenodes = [];
        for (let n = 0; n < args.states; n++) {
            const node = new joint.shapes.standard.Circle({stateNo: n, id: 'state' + n, isInit: n == args.init_state});
            node.attr('label/text', String(n));
            node.addTo(this.fsmgraph);
            statenodes.push(node);
        }
        for (const tr of args.trans_table) {
            const trans = new joint.shapes.standard.Link({
                ctrlIn: Vector3vl.fromBin(tr.ctrl_in, args.bits.in),
                ctrlOut: Vector3vl.fromBin(tr.ctrl_out, args.bits.out)
            });
            trans.appendLabel({
                attrs: {
                    text: {
                        text: trans.get('ctrlIn').toBin() + '/' + trans.get('ctrlOut').toBin()
                    }
                }
            });
            trans.source({ id: 'state' + tr.state_in });
            trans.target({ id: 'state' + tr.state_out });
            trans.addTo(this.fsmgraph);
        }
        Box.prototype.constructor.apply(this, arguments);
        this.last_clk = 0;
    },
    operation: function(data) {
        const bits = this.get('bits');
        const polarity = this.get('polarity');
        const next_trans = () => {
            const node = this.fsmgraph.getCell('state' + this.get('current_state'));
            const links = this.fsmgraph.getConnectedLinks(node, { outbound: true });
            for (const trans of links) {
                const ctrlIn = trans.get('ctrlIn');
                const xmask = ctrlIn.xmask();
                if (data.in.or(xmask).eq(ctrlIn.or(xmask)))
                    return trans;
            }
        };
        const pol = what => polarity[what] ? 1 : -1;
        if (data.arst.get(0) == pol('arst')) {
            this.set('current_state', this.get('init_state'));
        } else {
            const last_clk = this.last_clk;
            this.last_clk = data.clk.get(0);
            if (data.clk.get(0) == pol('clock') && last_clk == -pol('clock')) {
                const trans = next_trans();
                this.set('current_state',
                    trans ? trans.getTargetElement().get('stateNo') : this.get('init_state'));
            }
        }
        const trans = next_trans();
        if (!trans) return { out: Vector3vl.xes(bits.out) };
        else return { out: trans.get('ctrlOut') };
    }
});

export const FSMView = BoxView.extend({
});

