"use strict";

import $ from 'jquery';
import _ from 'lodash';
import * as joint from 'jointjs';
import { Box, BoxView } from './base';
import bigInt from 'big-integer';
import * as help from '../help.mjs';
import { Vector3vl, Mem3vl } from '3vl';

// Memory cell
export const Memory = Box.define('Memory', {
    attrs: {
        'line.portsplit': {
            stroke: 'black', x1: 0, x2: 40
        },
        '.tooltip': {
            'ref-x': 0, 'ref-y': -30,
            width: 80, height: 30
        },
    }
}, {
    initialize: function() {
        this.listenTo(this, 'change:size', (model, size) => {
            this.attr('line.portsplit/x2', size.width);
            this.attr('.tooltip/width', size.width)
        });
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
        markup.push(['<foreignObject class="tooltip">',
            '<body xmlns="http://www.w3.org/1999/xhtml">',
            '<a class="zoom">🔍</a>',
            '</body></foreignObject>'].join(''));
        this.markup = markup.join('');
        Box.prototype.constructor.apply(this, arguments);
    },
    operation: function(data) {
        const out = {};
        const check_enabled = (portname, port) => {
            const pol = what => port[what + '_polarity'] ? 1 : -1;
            const clkname = portname + 'clk';
            let last_clk;
            if ('clock_polarity' in port) {
                last_clk = this.last_clk[clkname];
                this.last_clk[clkname] = data[clkname].get(0);
            }
            if ('enable_polarity' in port && !data[portname + 'en'].toArray().some(x => x == pol('enable')))
                return false;
            if ('clock_polarity' in port) {
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
            if (valid_addr(addr)) {
                const changed = !this.memdata.get(addr).eq(data[portname + 'data']);
                this.memdata.set(addr, data[portname + 'data']);
                if (changed)
                    this.trigger("memChange", addr, data[portname + 'data']);
            }
        };
        for (const [num, port] of this.get('rdports').entries())
            if (!port.transparent) do_read('rd' + num, port);
        for (const [num, port] of this.get('wrports').entries())
            do_write('wr' + num, port);
        for (const [num, port] of this.get('rdports').entries())
            if (port.transparent) do_read('rd' + num, port);
        return out;
    },
    updateOutputs: function(addr) {
        if (addr < 0 || addr >= this.get('words')) return;
        const data = this.get('inputSignals');
        const calc_addr = sig => help.sig2bigint(sig, false) - this.get('offset');
        const sigs = _.clone(this.get('outputSignals'));
        let changed = false;
        for (const [num, port] of this.get('rdports').entries()) {
            const portname = 'rd' + num;
            if (port.transparent
                    && !('clock_polarity' in port)
                    && data[portname + 'addr'].isFullyDefined
                    && calc_addr(data[portname + 'addr']) == addr) {
                if ('enable_polarity' in port && !data[portname + 'en'].toArray().some(x => x == pol('enable')))
                    continue;
                changed = true;
                sigs[portname + 'data'] = this.memdata.get(addr);
            }
        }
        if (changed) this.set('outputSignals', sigs);
    },
    getGateParams: function() { 
        // hack to get memdata back
        const params = Box.prototype.getGateParams.apply(this, arguments);
        params.memdata = this.memdata.toJSON();
        return params;
    },
    gateParams: Box.prototype.gateParams.concat(['bits', 'abits', 'rdports', 'wrports', 'words', 'offset'])
});
export const MemoryView = BoxView.extend({
    events: {
        "click foreignObject.tooltip": "stopprop",
        "mousedown foreignObject.tooltip": "stopprop",
        "click a.zoom": "displayEditor"
    },
    displayEditor(evt) {
        evt.stopPropagation();
        const div = $('<div>', {
            title: "Memory contents: " + this.model.get('label')
        }).appendTo('html > body');
        div.append($(
            '<div class="btn-toolbar" role="toolbar">' +
            '<div class="btn-group mr-2" role="group">' +
            '<button name="prev" type="button" class="btn btn-secondary" title="Previous page">←</button>' +
            '<button name="next" type="button" class="btn btn-secondary" title="Next page">→</button>' +
            '</div>' + 
//            '<div class="btn-group mr-2" role="group">' +
//            '<button type="button" class="btn btn-secondary" title="Load contents">Load</button>' +
//            '<button type="button" class="btn btn-secondary" title="Save contents">Save</button>' +
//            '</div>' + 
            '<div class="input-group">' +
            '<select name="numbase">' + 
            '<option value="hex">hex</option>' +
            '<option value="dec">dec</option>' +
            '<option value="oct">oct</option>' +
            '<option value="bin">bin</option>' +
            '</select>' +
            '</div>' +
            '</div>' +
            '<table class="memeditor">' +
            '</table>'));
        const words = this.model.get('words');
        const memdata = this.model.memdata;
        const ahex = Math.ceil(this.model.get('abits')/4);
        const rows = 8;
        let columns, address = 0;
        const get_numbase = () => div.find('select[name=numbase]').val();
        const updateStuff = () => {
            const numbase = get_numbase();
            div.find('button[name=prev]').prop('disabled', address <= 0);
            div.find('button[name=next]').prop('disabled', address + rows * columns >= words);
            let row = div.find('table tr:first-child');
            const memdata = this.model.memdata;
            for (let r = 0; r < rows; r++, row = row.next()) {
                if (address + r * columns >= words) break;
                const addrs = (address + r * columns).toString(16);
                let col = row.find('td:first-child');
                col.text('0'.repeat(ahex - addrs.length) + addrs)
                col = col.next();
                for (let c = 0; c < columns; c++, col = col.next()) {
                    if (address + r * columns + c >= words) break;
                    col.find('input').val(help.sig2base(memdata.get(address + r * columns + c), numbase))
                                     .removeClass('invalid');
                }
            }
        };
        const redraw = () => {
            const numbase = get_numbase();
            const bpd = help.bitsPerDigit(numbase);
            const ptrn = help.basePattern(numbase);
            const ds = Math.ceil(this.model.get('bits')/bpd);
            columns = Math.min(words, 16, Math.ceil(32/ds));
            address = Math.max(0, Math.min(words - rows * columns, address));
            const table = div.find('table');
            table.empty();
            for (let r = 0; r < rows; r++) {
                if (address + r * columns >= words) break;
                const row = $('<tr>');
                $('<td>').appendTo(row);
                for (let c = 0; c < columns; c++) {
                    if (address + r * columns + c >= words) break;
                    const col = $('<td>');
                    $('<input type="text">')
                        .attr('size', ds)
                        .attr('maxlength', ds)
                        .attr('pattern', ptrn)
                        .appendTo(col);
                    col.appendTo(row);
                }
                row.appendTo(table);
            }
            updateStuff();
        };
        redraw();
        div.find("select[name=numbase]").on('change', redraw);
        div.find("button[name=prev]").on('click', () => {
            address = Math.max(0, address - rows * columns);
            updateStuff();
        });
        div.find("button[name=next]").on('click', () => {
            address = Math.min(words - rows * columns, address + rows * columns);
            updateStuff();
        });
        div.on("change", "input", (evt) => {
            const numbase = get_numbase();
            const target = $(evt.target);
            const c = target.closest('td').index() - 1;
            const r = target.closest('tr').index();
            const addr = address + r * columns + c;
            if (help.validNumber(evt.target.value, numbase)) {
                const val = help.base2sig(evt.target.value, this.model.get('bits'), numbase);
                memdata.set(addr, val);
                this.model.updateOutputs(addr);
            } else {
                target.addClass('invalid');
            }
        });
        const changeCallback = (addr, data) => {
            if (addr < address || addr > address + rows * columns) return;
            const numbase = get_numbase();
            const r = Math.floor((addr - address) / columns);
            const c = addr - address - r * columns;
            const z = div.find('table tr:nth-child('+(r+1)+') td:nth-child('+(c+2)+') input')
                .val(help.sig2base(memdata.get(address + r * columns + c), numbase))
                .removeClass('invalid')
                .removeClass('flash');
            setTimeout(() => { z.addClass('flash') }, 10);
        };
        this.model.on("memChange", changeCallback);
        this.paper.trigger('open:memorycontent', div, () => {
            div.remove();
            this.model.off("memChange", changeCallback);
        });
        return false;
    }
});

