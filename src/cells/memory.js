"use strict";

import joint from 'jointjs';
import bigInt from 'big-integer';
import * as help from '@app/help.js';

// Memory cell
joint.shapes.digital.Gate.define('digital.Memory', {
    attrs: {
        'line.portsplit': {
            stroke: 'black'
        }
    }
}, {
    constructor: function(args) {
        if (!args.bits) args.bits = 1;
        if (!args.abits) args.abits = 1;
        if (!args.rdports) args.rdports = [];
        if (!args.wrports) args.wrports = [];
        if (!args.words) args.words = 1 << args.abits;
        if (!args.offset) args.offset = 0;
        if (args.memdata)
            args.memdata = args.memdata.slice();
        else
            args.memdata = Array(args.words).fill(Array(args.bits).fill(0));
        console.assert(args.memdata.length == args.words);
        this.last_clk = {};
        const markup = [];
        markup.push('<g class="rotatable">');
        let num = 0;
        const portsplits = [];
        function num_y(num) { return num * 16 + 12; }
        for (const [pnum, port] of args.rdports.entries()) {
            const portname = "rd" + pnum;
            markup.push(this.addWire(args, 'right', num_y(num), { id: portname + 'data', dir: 'out', bits: args.bits }));
            markup.push(this.addWire(args, 'left', num_y(num++), { id: portname + 'addr', dir: 'in', bits: args.abits }));
            if ('enable_polarity' in port)
                markup.push(this.addWire(args, 'left', num_y(num++), { id: portname + 'en', dir: 'in', bits: 1 }));
            if ('clock_polarity' in port) {
                markup.push(this.addWire(args, 'left', num_y(num++), { id: portname + 'clk', dir: 'in', bits: 1 }));
                this.last_clk[portname + 'clk'] = 0;
            } else {
                port.transparent = true;
            }
            portsplits.push(num);
        }
        for (const [pnum, port] of args.wrports.entries()) {
            const portname = "wr" + pnum;
            markup.push(this.addWire(args, 'left', num_y(num++), { id: portname + 'data', dir: 'in', bits: args.bits }));
            markup.push(this.addWire(args, 'left', num_y(num++), { id: portname + 'addr', dir: 'in', bits: args.abits }));
            if ('enable_polarity' in port)
                markup.push(this.addWire(args, 'left', num_y(num++), { id: portname + 'en', dir: 'in', bits: args.bits }));
            if ('clock_polarity' in port) {
                markup.push(this.addWire(args, 'left', num_y(num++), { id: portname + 'clk', dir: 'in', bits: 1 }));
                this.last_clk[portname + 'clk'] = 0;
            }
            portsplits.push(num);
        }
        const size = { width: 80, height: num*16+8 };
        args.size = size;
        _.set(args, ['attrs', '.body'], size);
        portsplits.pop();
        markup.push('<g class="scalable"><rect class="body"/>');
        for (const num of portsplits) {
            const yline = num_y(num) + 8;
            markup.push('<line class="portsplit" x1="0" x2="' + size.width +  '" y1="' + yline + '" y2="' + yline + '" />');
        }
        markup.push('</g><text class="label"/>');
        markup.push('</g>');
        this.markup = markup.join('');
        joint.shapes.digital.Gate.prototype.constructor.apply(this, arguments);
    },
    operation: function(data) {
        const out = {};
        const check_enabled = (portname, port) => {
            const pol = what => port[what + '_polarity'] ? 1 : -1;
            if ('enable_polarity' in port && !data[portname + 'en'].some(x => x == pol('enable')))
                return false;
            if ('clock_polarity' in port) {
                const clkname = portname + 'clk';
                const last_clk = this.last_clk[clkname];
                this.last_clk[clkname] = data[clkname][0];
                return (data[clkname][0] == pol('clock') && last_clk == -pol('clock'));
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
                    out[portname + 'data'] = Array(this.get('bits')).fill(0);
                return;
            }
            if (data[portname + 'addr'].some(x => x == 0))
                out[portname + 'data'] = Array(this.get('bits')).fill(0);
            else {
                const addr = calc_addr(data[portname + 'addr']);
                if (valid_addr(addr))
                    out[portname + 'data'] = this.get('memdata')[addr];
                else
                    out[portname + 'data'] = Array(this.get('bits')).fill(0);
            }
        };
        const do_write = (portname, port) => {
            if (!check_enabled(portname, port)) return;
            if (data[portname + 'addr'].some(x => x == 0)) return;
            const addr = calc_addr(data[portname + 'addr']);
            if (valid_addr(addr))
                this.get('memdata')[addr] = data[portname + 'data'];
        };
        for (const [num, port] of this.get('rdports').entries())
            if (!port.transparent) do_read('rd' + num, port);
        for (const [num, port] of this.get('wrports').entries())
            do_write('wr' + num, port);
        for (const [num, port] of this.get('rdports').entries())
            if (port.transparent) do_read('rd' + num, port);
        return out;
    }
});

