"use strict";

import $ from 'jquery';
import _ from 'lodash';
import * as joint from 'jointjs';
import { Box, BoxView } from './base';
import bigInt from 'big-integer';
import * as help from '../help.mjs';
import { display3vl } from '../help.mjs';
import { Vector3vl, Mem3vl } from '3vl';

// Memory cell
export const Memory = Box.define('Memory', {
    /* default properties */
    bits: 1,
    abits: 1,
    rdports: [],
    wrports: [],
    words: undefined,
    offset: 0,
    
    attrs: {
        'path.portsplit': {
            stroke: 'black', d: undefined
        }
    },
    ports: {
        groups: {
            'in': {
                position: Box.prototype.getStackedPosition({ side: 'left' })
            },
            'out': {
                position: Box.prototype.getStackedPosition({ side: 'right' })
            }
        }
    }
}, {
    initialize: function() {
        Box.prototype.initialize.apply(this, arguments);
        
        const bits = this.prop('bits');
        const abits = this.prop('abits');
        const rdports = this.prop('rdports');
        const wrports = this.prop('wrports');
        var words = this.prop('words');
        const memdata = this.prop('memdata');
        
        if (!words) {
            words = 1 << abits;
            this.prop('words', words, { init: true });
        }
        if (memdata)
            this.memdata = Mem3vl.fromJSON(bits, memdata);
        else
            this.memdata = new Mem3vl(bits, words);
        console.assert(this.memdata.words == words);
        this.removeProp('memdata'); // performance hack
        
        this.last_clk = {};
        let num = 0;
        let idxOffset = 0;
        const portsplits = [];
        for (const [pnum, port] of rdports.entries()) {
            const portname = "rd" + pnum;
            this.addPorts([
                { id: portname + 'addr', group: 'in', dir: 'in', bits: bits, portlabel: 'addr' },
                { id: portname + 'data', group: 'out', dir: 'out', bits: bits, portlabel: 'data', args: { idxOffset: idxOffset } }
            ], { labelled: true });
            num += 1;
            if ('enable_polarity' in port) {
                num++;
                idxOffset++;
                this.addPort({ id: portname + 'en', group: 'in', dir: 'in', bits: 1, portlabel: 'en', polarity: port.enable_polarity }, { labelled: true });
            }
            if ('clock_polarity' in port) {
                num++;
                idxOffset++;
                this.addPort({ id: portname + 'clk', group: 'in', dir: 'in', bits: 1, portlabel: 'clk', polarity: port.clock_polarity, decor: Box.prototype.decorClock }, { labelled: true });
                this.last_clk[portname + 'clk'] = 0;
            } else {
                port.transparent = true;
            }
            portsplits.push(num);
        }
        for (const [pnum, port] of wrports.entries()) {
            const portname = "wr" + pnum;
            num += 2;
            this.addPorts([
                { id: portname + 'data', group: 'in', dir: 'in', bits: bits, portlabel: 'data' },
                { id: portname + 'addr', group: 'in', dir: 'in', bits: bits, portlabel: 'addr' }
            ], { labelled: true });
            if ('enable_polarity' in port) {
                num++;
                this.addPort({ id: portname + 'en', group: 'in', dir: 'in', bits: 1, portlabel: 'en', polarity: port.enable_polarity }, { labelled: true });
            }
            if ('clock_polarity' in port) {
                num++;
                this.addPort({ id: portname + 'clk', group: 'in', dir: 'in', bits: 1, portlabel: 'clk', polarity: port.clock_polarity, decor: Box.prototype.decorClock }, { labelled: true });
                this.last_clk[portname + 'clk'] = 0;
            }
            portsplits.push(num);
        }
        portsplits.pop();
        
        this.on('change:size', (_, size) => {
            // only adapting to changed width
            const path = [];
            for (const num of portsplits) {
                path.push([
                    [0, 16*num + 4],
                    [size.width, 16*num + 4]
                ].map(p => p.join(' ')).join(' L '));
            }
            this.attr('path.portsplit/d', 'M ' + path.join(' M '));
        });
        const height = num*16+8;
        this.prop('size/height', height);
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
    markup: Box.prototype.markup.concat([{
            tagName: 'path',
            className: 'portsplit'
        }], Box.prototype.markupZoom),
    getGateParams: function() { 
        // hack to get memdata back
        const params = Box.prototype.getGateParams.apply(this, arguments);
        params.memdata = this.memdata.toJSON();
        return params;
    },
    gateParams: Box.prototype.gateParams.concat(['bits', 'abits', 'rdports', 'wrports', 'words', 'offset']),
    unsupportedPropChanges: Box.prototype.unsupportedPropChanges.concat(['bits', 'abits', 'rdports', 'wrports', 'words', 'offset'])
});
export const MemoryView = BoxView.extend({
    autoResizeBox: true,
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
            help.baseSelectMarkupHTML(this.model.get('bits'), 'hex') +
            '</div>' +
            '</div>' +
            '<table class="memeditor">' +
            '</table>'));
        const words = this.model.get('words');
        const memdata = this.model.memdata;
        const ahex = Math.ceil(this.model.get('abits')/4);
        const rows = 8;
        let columns, address = 0;
        const get_numbase = () => div.find('select[name=base]').val();
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
                    col.find('input').val(display3vl.show(numbase, memdata.get(address + r * columns + c)))
                                     .removeClass('invalid');
                }
            }
        };
        const redraw = () => {
            const numbase = get_numbase();
            const ptrn = display3vl.pattern(numbase);
            const ds = display3vl.size(numbase, this.model.get('bits')); 
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
        div.find("select[name=base]").on('change', redraw);
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
            if (display3vl.validate(numbase, evt.target.value)) {
                const val = display3vl.read(numbase, evt.target.value, this.model.get('bits'));
                memdata.set(addr, val);
                this.model.updateOutputs(addr);
                target.removeClass('invalid');
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
                .val(display3vl.show(numbase, memdata.get(address + r * columns + c)))
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

