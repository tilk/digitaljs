"use strict";

import * as joint from 'jointjs';
import { Box, BoxView } from './base.mjs';
import * as help from '../help.mjs';
import { Vector3vl } from '3vl';

// D flip-flops
export const Dff = Box.define('Dff', {
    /* default properties */
    bits: 1,
    initial: 'x',

    size: { width: 80, height: undefined },
    ports: {
        groups: {
            'in': {
                position: Box.prototype._getStackedPosition({ side: 'left' })
            },
            'out': {
                position: Box.prototype._getStackedPosition({ side: 'right' })
            }
        }
    }
}, {
    initialize() {
        const bits = this.get('bits');
        const initial = this.get('initial');
        const polarity = this.get('polarity') || {};
        
        const ports = [];
        
        ports.push(
            { id: 'in', group: 'in', dir: 'in', bits: bits, portlabel: 'D', labelled: true },
            { id: 'out', group: 'out', dir: 'out', bits: bits, portlabel: 'Q', labelled: true }
        );
        
        if ('arst' in polarity && !this.get('arst_value'))
            this.set('arst_value', Array(bits).fill('0').join(''));
        
        if ('srst' in polarity && !this.get('srst_value'))
            this.set('srst_value', Array(bits).fill('0').join(''));

        let num = 1;
        if ('clock' in polarity) {
            num++;
            ports.push({ id: 'clk', group: 'in', dir: 'in', bits: 1, polarity: polarity.clock, decor: Box.prototype.decorClock, labelled: true });
        }
        if ('srst' in polarity) {
            num++;
            ports.push({ id: 'srst', group: 'in', dir: 'in', bits: 1, polarity: polarity.srst, labelled: true });
        }
        if ('arst' in polarity) {
            num++;
            ports.push({ id: 'arst', group: 'in', dir: 'in', bits: 1, polarity: polarity.arst, labelled: true });
        }
        if ('enable' in polarity) {
            num++;
            ports.push({ id: 'en', group: 'in', dir: 'in', bits: 1, polarity: polarity.enable, labelled: true });
        }
        
        this.get('size').height = num*16+8;
        this.get('ports').items = ports;
        this.last_clk = 0;
        
        Box.prototype.initialize.apply(this, arguments);
    },
    _resetPortValue(port) {
        if (port.id == "out" && port.dir == "out")
            return Vector3vl.fromBin(this.get('initial'), port.bits);
        else return Box.prototype._resetPortValue.call(this, port);
    },
    operation(data) {
        const polarity = this.get('polarity');
        const pol = what => polarity[what] ? 1 : -1
        let last_clk;
        if ('clock' in polarity) {
            last_clk = this.last_clk;
            this.last_clk = data.clk.get(0);
        }
        if ('arst' in polarity && data.arst.get(0) == pol('arst'))
            return { out: Vector3vl.fromBin(this.get('arst_value'), this.get('bits')) };
        if ('enable' in polarity && data.en.get(0) != pol('enable') && this.get('enable_srst'))
            return this.get('outputSignals');
        if (!('clock' in polarity) || data.clk.get(0) == pol('clock') && last_clk == -pol('clock')) {
            if ('srst' in polarity && data.srst.get(0) == pol('srst'))
                return { out: Vector3vl.fromBin(this.get('srst_value'), this.get('bits')) };
            if ('enable' in polarity && data.en.get(0) != pol('enable') && !this.get('enable_srst'))
                return this.get('outputSignals');
            return { out: data.in };
        } else return this.get('outputSignals');
    },
    _gateParams: Box.prototype._gateParams.concat(['polarity', 'bits', 'initial', 'arst_value', 'srst_value', 'enable_srst']),
    _unsupportedPropChanges: Box.prototype._unsupportedPropChanges.concat(['polarity', 'bits', 'initial', 'arst_value', 'srst_value', 'enable_srst'])
});
export const DffView = BoxView.extend({
    _autoResizeBox: true
});

