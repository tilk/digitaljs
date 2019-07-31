"use strict";

import * as joint from 'jointjs';
import { Box, BoxView } from '@app/cells/base';
import bigInt from 'big-integer';
import * as help from '@app/help.js';
import { Vector3vl, Mem3vl } from '3vl';

// Memory cell
export const Memory = Box.define('Memory', {
    attrs: {
        'line.portsplit': {
            stroke: 'black', x1: 0, x2: 40
        }
    }
}, {
    initialize: function() {
        this.listenTo(this, 'change:size', (model, size) => this.attr('line.portsplit/x2', size.width));
        Box.prototype.initialize.apply(this, arguments);
    },
    constructor: function(args) {
        if (!args.bits) args.bits = 1;
        if (!args.abits) args.abits = 1;
        if (!args.rdports) args.rdports = [];
        if (!args.wrports) args.wrports = [];
        if (!args.words) args.words = 1 << args.abits;
        if (!args.offset) args.offset = 0;
        if (args.memdata)
            this.memdata = Mem3vl.fromJSON(args.bits, args.memdata);
        else
            this.memdata = new Mem3vl(args.bits, args.words);
        delete args.memdata; // performance hack
        console.assert(this.memdata.words == args.words);
        this.last_clk = {};
        const markup = [];
        const lblmarkup = [];
        let num = 0;
        const portsplits = [];
        function num_y(num) { return num * 16 + 12; }
        for (const [pnum, port] of args.rdports.entries()) {
            const portname = "rd" + pnum;
            markup.push(this.addLabelledWire(args, lblmarkup, 'right', num_y(num), { id: portname + 'data', dir: 'out', bits: args.bits, label: 'data' }));
            markup.push(this.addLabelledWire(args, lblmarkup, 'left', num_y(num++), { id: portname + 'addr', dir: 'in', bits: args.abits, label: 'addr' }));
            if ('enable_polarity' in port)
                markup.push(this.addLabelledWire(args, lblmarkup, 'left', num_y(num++), { id: portname + 'en', dir: 'in', bits: 1, label: 'en', polarity: port.enable_polarity }));
            if ('clock_polarity' in port) {
                markup.push(this.addLabelledWire(args, lblmarkup, 'left', num_y(num++), { id: portname + 'clk', dir: 'in', bits: 1, label: 'clk', polarity: port.clock_polarity, clock: true }));
                this.last_clk[portname + 'clk'] = 0;
            } else {
                port.transparent = true;
            }
            portsplits.push(num);
        }
        for (const [pnum, port] of args.wrports.entries()) {
            const portname = "wr" + pnum;
            markup.push(this.addLabelledWire(args, lblmarkup, 'left', num_y(num++), { id: portname + 'data', dir: 'in', bits: args.bits, label: 'data' }));
            markup.push(this.addLabelledWire(args, lblmarkup, 'left', num_y(num++), { id: portname + 'addr', dir: 'in', bits: args.abits, label: 'addr' }));
            if ('enable_polarity' in port)
                markup.push(this.addLabelledWire(args, lblmarkup, 'left', num_y(num++), { id: portname + 'en', dir: 'in', bits: args.bits, label: 'en', polarity: port.enable_polarity }));
            if ('clock_polarity' in port) {
                markup.push(this.addLabelledWire(args, lblmarkup, 'left', num_y(num++), { id: portname + 'clk', dir: 'in', bits: 1, label: 'clk', polarity: port.clock_polarity, clock: true }));
                this.last_clk[portname + 'clk'] = 0;
            }
            portsplits.push(num);
        }
        const size = { width: 80, height: num*16+8 };
        args.size = size;
        portsplits.pop();
        markup.push('<rect class="body"/>');
        for (const num of portsplits) {
            const yline = num_y(num) - 8;
            markup.push('<line class="portsplit" y1="' + yline + '" y2="' + yline + '" />');
        }
        markup.push('<text class="label"/>');
        markup.push(lblmarkup.join(''));
        this.markup = markup.join('');
        Box.prototype.constructor.apply(this, arguments);
    },
    operation: function(data) {
        const out = {};
        const check_enabled = (portname, port) => {
            const pol = what => port[what + '_polarity'] ? 1 : -1;
            if ('enable_polarity' in port && !data[portname + 'en'].toArray().some(x => x == pol('enable')))
                return false;
            if ('clock_polarity' in port) {
                const clkname = portname + 'clk';
                const last_clk = this.last_clk[clkname];
                this.last_clk[clkname] = data[clkname].get(0);
                return (data[clkname].get(0) == pol('clock') && last_clk == -pol('clock'));
            }
            return true;
        };
        const calc_addr = sig => help.sig2bigint(sig, false) - this.get('offset');
        const valid_addr = n => n >= 0 && n < this.get('words');
        const do_read = (portname, port) => {
            if (!check_enabled(portname, port)) {
                if ('clock_polarity' in port)
                    out[portname + 'data'] = this.get('outputSignals')[portname + 'data'];
                else
                    out[portname + 'data'] = Vector3vl.xes(this.get('bits'));
                return;
            }
            if (!data[portname + 'addr'].isFullyDefined)
                out[portname + 'data'] = Vector3vl.xes(this.get('bits'));
            else {
                const addr = calc_addr(data[portname + 'addr']);
                if (valid_addr(addr))
                    out[portname + 'data'] = this.memdata.get(addr);
                else
                    out[portname + 'data'] = Vector3vl.xes(this.get('bits'));
            }
        };
        const do_write = (portname, port) => {
            if (!check_enabled(portname, port)) return;
            if (!data[portname + 'addr'].isFullyDefined) return;
            const addr = calc_addr(data[portname + 'addr']);
            if (valid_addr(addr))
                this.memdata.set(addr, data[portname + 'data']);
        };
        for (const [num, port] of this.get('rdports').entries())
            if (!port.transparent) do_read('rd' + num, port);
        for (const [num, port] of this.get('wrports').entries())
            do_write('wr' + num, port);
        for (const [num, port] of this.get('rdports').entries())
            if (port.transparent) do_read('rd' + num, port);
        return out;
    },
    getGateParams: function() { 
        // hack to get memdata back
        const params = Box.prototype.getGateParams.apply(this, arguments);
        params.memdata = this.memdata.toJSON();
        return params;
    },
    gateParams: Box.prototype.gateParams.concat(['bits', 'abits', 'rdports', 'wrports', 'words', 'offset'])
});
export const MemoryView = BoxView;

