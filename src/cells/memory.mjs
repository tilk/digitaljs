"use strict";

import $ from 'jquery';
import { Box, BoxView } from './base.mjs';
import * as help from '../help.mjs';
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
        portsplit: {
            stroke: 'black'
        }
    },
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
        const abits = this.get('abits');
        const rdports = this.get('rdports');
        const wrports = this.get('wrports');
        
        let num = 0;
        let idxOffset = 0;
        const ports = [], portsplits = [];
        for (const [portname, port] of this._memrdports()) {
            ports.push(
                { id: portname + 'addr', group: 'in', dir: 'in', bits: abits, portlabel: 'addr', labelled: true },
                { id: portname + 'data', group: 'out', dir: 'out', bits: bits, portlabel: 'data', labelled: true, args: { idxOffset: idxOffset } }
            );
            num += 1;
            if ('srst_polarity' in port) {
                num++;
                idxOffset++;
                ports.push({ id: portname + 'srst', group: 'in', dir: 'in', bits: 1, portlabel: 'srst', polarity: port.srst_polarity, labelled: true });
            }
            if ('arst_polarity' in port) {
                num++;
                idxOffset++;
                ports.push({ id: portname + 'arst', group: 'in', dir: 'in', bits: 1, portlabel: 'arst', polarity: port.arst_polarity, labelled: true });
            }
            if ('enable_polarity' in port) {
                num++;
                idxOffset++;
                ports.push({ id: portname + 'en', group: 'in', dir: 'in', bits: 1, portlabel: 'en', polarity: port.enable_polarity, labelled: true });
            }
            if ('clock_polarity' in port) {
                num++;
                idxOffset++;
                ports.push({ id: portname + 'clk', group: 'in', dir: 'in', bits: 1, portlabel: 'clk', polarity: port.clock_polarity, decor: Box.prototype.decorClock, labelled: true });
            }
            portsplits.push(num);
        }
        for (const [portname, port] of this._memwrports()) {
            num += 2;
            ports.push(
                { id: portname + 'data', group: 'in', dir: 'in', bits: bits, portlabel: 'data', labelled: true },
                { id: portname + 'addr', group: 'in', dir: 'in', bits: abits, portlabel: 'addr', labelled: true }
            );
            if ('enable_polarity' in port) {
                num++;
                ports.push({ id: portname + 'en', group: 'in', dir: 'in', bits: port.no_bit_enable ? 1 : bits, portlabel: 'en', polarity: port.enable_polarity, labelled: true });
            }
            if ('clock_polarity' in port) {
                num++;
                ports.push({ id: portname + 'clk', group: 'in', dir: 'in', bits: 1, portlabel: 'clk', polarity: port.clock_polarity, decor: Box.prototype.decorClock, labelled: true });
            }
            portsplits.push(num);
        }
        portsplits.pop();
        this.get('size').height = num*16+8;
        this.get('ports').items = ports;
        
        Box.prototype.initialize.apply(this, arguments);
        
        this.removeProp('memdata'); // performance hack
        
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
    },
    _resetPortValue(port) {
        if (port.dir == "out") {
            const res = /^rd([0-9]+)data$/.exec(port.id);
            const portdata = res ? this.get('rdports')[res[1]] : {};
            if ('init_value' in portdata)
                return Vector3vl.fromBin(portdata.init_value, port.bits);
        }
        return Box.prototype._resetPortValue.call(this, port);
    },
    prepare() {
        const bits = this.get('bits');
        var words = this.get('words');
        const memdata = this.get('memdata');
        
        if (!words) {
            words = 1 << this.get('abits');
            this.prop('words', words, { init: true });
        }
        if (memdata)
            this.memdata = Mem3vl.fromJSON(bits, memdata);
        else
            this.memdata = new Mem3vl(bits, words);
        console.assert(this.memdata.words == words);
        
        this.last_clk = {};
        for (const [portname, port] of this._memports()) {
            if ('clock_polarity' in port)
                this.last_clk[portname + 'clk'] = 0;
        }
    },
    operation(data) {
        const bits = this.get('bits');
        const out = {};
        const pol = (port, what) => port[what + '_polarity'] ? 1 : -1;
        const is_enabled = (portname, port) => {
            if ('enable_polarity' in port && !data[portname + 'en'].toArray().some(x => x == pol(port, 'enable')))
                return false;
            return true;
        };
        const port_active = (portname, port) => {
            const clkname = portname + 'clk';
            if ('clock_polarity' in port) {
                return (data[clkname].get(0) == pol(port, 'clock') && this.last_clk[clkname] == -pol(port, 'clock'));
            }
            return true;
        };
        const valid_addr = n => n >= 0 && n < this.get('words');
        const do_comb_read = (portname, port) => {
            const addr = this._calcaddr(data[portname + 'addr']);
            if (valid_addr(addr))
                out[portname + 'data'] = this.memdata.get(addr);
            else
                out[portname + 'data'] = Vector3vl.xes(bits);
        };
        const write_value = (portname, port, oldval, val) => {
            if (port.no_bit_enable || !('enable_polarity' in port))
                return val;
            const mask = port.enable_polarity ? data[portname + 'en'] : data[portname + 'en'].not();
            return val.and(mask).or(oldval.and(mask.not()));
        };
        const do_read = (portname, port) => {
            do_comb_read(portname, port);
            for (const [num, wrport] of this.get('wrports').entries()) {
                const wrportname = 'wr' + num;
                const mask_ok = (val, num) => typeof val == 'boolean' ? val : val[num];
                if ('transparent' in port && mask_ok(port.transparent, num) && port_active(wrportname, wrport) && is_enabled(wrportname, wrport) && data[portname + 'addr'] == data[wrportname + 'addr'])
                    out[portname + 'data'] = write_value(wrportname, wrport, out[portname + 'data'], data[wrportname + 'data']);
                if ('collision' in port && mask_ok(port.collision, num) && port_active(wrportname, wrport) && is_enabled(wrportname, wrport) && data[portname + 'addr'] == data[wrportname + 'addr'])
                    out[portname + 'data'] = write_value(wrportname, wrport, out[portname + 'data'], Vector3vl.xes(bits));
            }

        };
        const do_write = (portname, port) => {
            const addr = this._calcaddr(data[portname + 'addr']);
            if (valid_addr(addr)) {
                const oldval = this.memdata.get(addr);
                const newval = write_value(portname, port, oldval, data[portname + 'data']);
                const changed = !oldval.eq(newval);
                this.memdata.set(addr, newval);
                if (changed)
                    this.trigger("memChange", addr, newval);
            }
        };
        const do_srst = (portname, port) => {
            if (data[portname + 'srst'].get(0) == pol(port, 'srst'))
                out[portname + 'data'] = 'srst_value' in port
                                       ? Vector3vl.fromBin(port.srst_value, bits)
                                       : Vector3vl.zeros(bits);
        };
        const do_arst = (portname, port) => {
            if (data[portname + 'arst'].get(0) == pol(port, 'arst'))
                out[portname + 'data'] = 'arst_value' in port
                                       ? Vector3vl.fromBin(port.arst_value, bits)
                                       : Vector3vl.zeros(bits);
        };
        const update_last_clk = (portname, port) => {
            if ('clock_polarity' in port) {
                const clkname = portname + 'clk';
                this.last_clk[clkname] = data[clkname].get(0);
            }
        };
        for (const [portname, port] of this._memrdports()) {
            out[portname + 'data'] = this.get('outputSignals')[portname + 'data'];
            if ('clock_polarity' in port && is_enabled(portname, port) && port_active(portname, port))
                do_read(portname, port);
        }
        for (const [portname, port] of this._memwrports())
            if (is_enabled(portname, port) && port_active(portname, port))
                do_write(portname, port);
        for (const [portname, port] of this._memrdports())
            if (!('clock_polarity' in port) && is_enabled(portname, port))
                do_comb_read(portname, port);
        for (const [portname, port] of this._memrdports()) {
            if ('srst_polarity' in port && (is_enabled(portname, port) || !('enable_srst' in port)) && port_active(portname, port))
                do_srst(portname, port);
            if ('arst_polarity' in port)
                do_arst(portname, port);
        }
        for (const [portname, port] of this._memrdports())
            update_last_clk(portname, port);
        for (const [portname, port] of this._memwrports())
            update_last_clk(portname, port);
        return out;
    },
    _calcaddr(sig) {
        if (!sig.isFullyDefined) return -1;
        return sig.toNumber() - this.get('offset');
    },
    * _memrdports() {
        for (const [num, port] of this.get('rdports').entries())
            yield ["rd" + num, port];
    },
    * _memwrports() {
        for (const [num, port] of this.get('wrports').entries())
            yield ["wr" + num, port];
    },
    * _memports() {
        yield* this._memrdports();
        yield* this._memwrports();
    },
    markup: Box.prototype.markup.concat([{
            tagName: 'path',
            className: 'portsplit',
            selector: 'portsplit'
        }], Box.prototype.markupZoom),
    getGateParams() {
        // hack to get memdata back
        const params = Box.prototype.getGateParams.apply(this, arguments);
        params.memdata = this.memdata.toJSON();
        return params;
    },
    _gateParams: Box.prototype._gateParams.concat(['bits', 'abits', 'rdports', 'wrports', 'words', 'offset']),
    _unsupportedPropChanges: Box.prototype._unsupportedPropChanges.concat(['bits', 'abits', 'rdports', 'wrports', 'words', 'offset']),
    _operationHelpers: Box.prototype._operationHelpers.concat(['_memrdports', '_memwrports', '_memports', '_calcaddr'])
});
export const MemoryView = BoxView.extend({
    _autoResizeBox: true,
    events: {
        "click foreignObject.tooltip": "stopprop",
        "mousedown foreignObject.tooltip": "stopprop",
        "touchstart foreignObject.tooltip": "stopprop", // make sure the input receives focus
        "click a.zoom": "_displayEditor"
    },
    _displayEditor(evt) {
        evt.stopPropagation();
        const model = this.model;
        const display3vl = model.graph._display3vl;
        const div = $('<div>', {
            title: "Memory contents: " + model.get('label')
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
            help.baseSelectMarkupHTML(display3vl, model.get('bits'), 'hex') +
            '</div>' +
            '</div>' +
            '<table class="memeditor">' +
            '</table>'));
        const words = model.get('words');
        const memdata = model.memdata;
        const ahex = Math.ceil(model.get('abits')/4);
        const rows = 8;
        let columns, address = 0;
        const get_numbase = () => div.find('select[name=base]').val();
        const getCell = (addr) => {
            const r = Math.floor((addr - address) / columns);
            const c = addr - address - r * columns;
            return div.find('table tr:nth-child('+(r+1)+') td:nth-child('+(c+2)+') input');
        }
        const clearMarkings = (sigs) => {
            for (const [portname, port] of model._memrdports()) {
                getCell(model._calcaddr(sigs[portname + 'addr'])).removeClass('isread');
            }
            for (const [portname, port] of model._memwrports()) {
                getCell(model._calcaddr(sigs[portname + 'addr'])).removeClass('iswrite');
            }
        }
        const displayMarkings = (sigs) => {
            for (const [portname, port] of model._memrdports()) {
                getCell(model._calcaddr(sigs[portname + 'addr'])).addClass('isread');
            }
            for (const [portname, port] of model._memwrports()) {
                getCell(model._calcaddr(sigs[portname + 'addr'])).addClass('iswrite');
            }
        }
        const updateStuff = () => {
            const numbase = get_numbase();
            div.find('button[name=prev]').prop('disabled', address <= 0);
            div.find('button[name=next]').prop('disabled', address + rows * columns >= words);
            let row = div.find('table tr:first-child');
            const memdata = model.memdata;
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
            displayMarkings(model.get('inputSignals'));
        };
        const redraw = () => {
            const numbase = get_numbase();
            const ptrn = display3vl.pattern(numbase);
            const ds = display3vl.size(numbase, model.get('bits')); 
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
            clearMarkings(model.get('inputSignals'));
            address = Math.max(0, address - rows * columns);
            updateStuff();
        });
        div.find("button[name=next]").on('click', () => {
            clearMarkings(model.get('inputSignals'));
            address = Math.min(words - rows * columns, address + rows * columns);
            updateStuff();
        });
        div.on("change", "input", (evt) => {
            const numbase = get_numbase();
            const target = $(evt.target);
            const c = target.closest('td').index() - 1;
            const r = target.closest('tr').index();
            const addr = address + r * columns + c;
            const bits = model.get('bits');
            if (display3vl.validate(numbase, evt.target.value, bits)) {
                const val = display3vl.read(numbase, evt.target.value, bits);
                memdata.set(addr, val);
                model.trigger('manualMemChange', model, addr, val);
                target.removeClass('invalid');
            } else {
                target.addClass('invalid');
            }
        });
        const mem_change_cb = (addr, data) => {
            if (addr < address || addr > address + rows * columns) return;
            const numbase = get_numbase();
            const z = getCell(addr)
                .val(display3vl.show(numbase, memdata.get(addr)))
                .removeClass('invalid')
                .removeClass('flash');
            setTimeout(() => { z.addClass('flash') }, 10);
        };
        const input_change_cb = (gate, sigs) => {
            clearMarkings(model.previous('inputSignals'));
            displayMarkings(sigs);
        };
        model.on("memChange", mem_change_cb);
        model.on("change:inputSignals", input_change_cb);
        this.paper.trigger('open:memorycontent', div, () => {
            div.remove();
            model.off("memChange", mem_change_cb);
            model.off("change:inputSignals", input_change_cb);
        });
        return false;
    }
});

