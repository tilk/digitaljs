"use strict";

import $ from 'jquery';
import _ from 'lodash';
import { Box, BoxView } from './base.mjs';
import * as help from '../help.mjs';
import { Vector3vl, Mem3vl } from '3vl';

// LUT cell
export const LUT = Box.define('LUT', {
    /* default properties */
    bits: {
        in: 1,
        out: 1
    },

    attrs: {
        oper: {
            refX: .5, refY: .5,
            textAnchor: 'middle', textVerticalAnchor: 'middle',
            fontSize: '8pt',
            text: 'LUT'
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
        this.get('ports').items = [
            { id: 'in', group: 'in', dir: 'in', bits: bits.in },
            { id: 'out', group: 'out', dir: 'out', bits: bits.out }
        ];

        Box.prototype.initialize.apply(this, arguments);

        this.on('change:bits', (_,bits) => {
            this._setPortsBits(bits);
        });

        this.removeProp('lutdata'); // performance hack
    },
    prepare() {
        const bits = this.get('bits');
        const words = 1 << bits.in;
        const lut = this.get('lut');
        const lutdata = this.get('lutdata');

        if (lutdata)
            this.lutdata = Mem3vl.fromJSON(bits.out, lutdata);
        else {
            this.lutdata = new Mem3vl(bits.out, words);
            if (lut) {
                for (let i = 0; i < words; i++) {
                    if (i < lut.length)
                        this.lutdata.set(i, Vector3vl.fromBin(lut[i], bits.out));
                }
            }
        }
        console.assert(this.lutdata.words == words);
    },
    operation(data) {
        const bits = this.get('bits');
        const words = 1 << bits.in;
        const valid_addr = n => n >= 0 && n < words;
        const addr = data.in.isFullyDefined ? data.in.toNumber() : -1;
        return {
            out: valid_addr(addr) ? this.lutdata.get(addr) : Vector3vl.xes(bits.out)
        };
    },
    markup: Box.prototype.markup.concat([{
        tagName: 'text',
        className: 'oper',
        selector: 'oper'
    }], Box.prototype.markupZoom),
    getGateParams() {
        // hack to get lutdata back
        const params = Box.prototype.getGateParams.apply(this, arguments);
        params.lutdata = this.lutdata.toJSON();
        return params;
    },
    _gateParams: Box.prototype._gateParams.concat(['bits']),
    _unsupportedPropChanges: Box.prototype._unsupportedPropChanges.concat(['bits'])
});
export const LUTView = BoxView.extend({
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
            title: "LUT contents: " + model.get('label')
        }).appendTo('html > body');
        div.append($(
            '<div class="btn-toolbar" role="toolbar">' +
            '<div class="btn-group mr-2" role="group">' +
            '<button name="prev" type="button" class="btn btn-secondary" title="Previous page">←</button>' +
            '<button name="next" type="button" class="btn btn-secondary" title="Next page">→</button>' +
            '</div>' +
            '<div class="input-group">' +
            help.baseSelectMarkupHTML(display3vl, model.get('bits'), 'hex') +
            '</div>' +
            '</div>' +
            '<table class="memeditor">' +
            '</table>'));
        const bits = model.get('bits');
        const words = 1 << bits.in;
        const lutdata = model.lutdata;
        const ahex = Math.ceil(bits.in / 4);
        const rows = 8;
        let columns, address = 0;
        const get_numbase = () => div.find('select[name=base]').val();
        const getCell = (addr) => {
            const r = Math.floor((addr - address) / columns);
            const c = addr - address - r * columns;
            return div.find('table tr:nth-child('+(r+1)+') td:nth-child('+(c+2)+') input');
        }
        const clearMarkings = (sigs) => {
            if (sigs.in.isFullyDefined)
                getCell(sigs.in.toNumber()).removeClass('isread');
        }
        const displayMarkings = (sigs) => {
            if (sigs.in.isFullyDefined)
                getCell(sigs.in.toNumber()).addClass('isread');
        }
        const updateStuff = () => {
            const numbase = get_numbase();
            div.find('button[name=prev]').prop('disabled', address <= 0);
            div.find('button[name=next]').prop('disabled', address + rows * columns >= words);
            let row = div.find('table tr:first-child');
            const lutdata = model.lutdata;
            for (let r = 0; r < rows; r++, row = row.next()) {
                if (address + r * columns >= words) break;
                const addrs = (address + r * columns).toString(16);
                let col = row.find('td:first-child');
                col.text('0'.repeat(ahex - addrs.length) + addrs)
                col = col.next();
                for (let c = 0; c < columns; c++, col = col.next()) {
                    if (address + r * columns + c >= words) break;
                    col.find('input').val(display3vl.show(numbase, lutdata.get(address + r * columns + c)))
                                     .removeClass('invalid');
                }
            }
            displayMarkings(model.get('inputSignals'));
        };
        const redraw = () => {
            const bits = model.get('bits');
            const numbase = get_numbase();
            const ptrn = display3vl.pattern(numbase);
            const ds = display3vl.size(numbase, bits.out);
            columns = Math.min(words, 16, Math.ceil(32 / ds));
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
            if (display3vl.validate(numbase, evt.target.value, bits.out)) {
                const val = display3vl.read(numbase, evt.target.value, bits.out);
                lutdata.set(addr, val);
                model.trigger('manualLutChange', model, addr, val);
                target.removeClass('invalid');
            } else {
                target.addClass('invalid');
            }
        });
        const mem_change_cb = (addr, data) => {
            if (addr < address || addr > address + rows * columns) return;
            const numbase = get_numbase();
            const z = getCell(addr)
                .val(display3vl.show(numbase, lutdata.get(addr)))
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
