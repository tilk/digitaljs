"use strict";

import joint from 'jointjs';
import _ from 'lodash';
import $ from 'jquery';
import Backbone from 'backbone';
import * as help from './help.mjs';
import * as cells from './cells.mjs';
import { display3vl } from './help.mjs';
import { Vector3vl } from '3vl';

let uniq_cntr = 0;

export class IOPanelView extends Backbone.View {
    initialize(args) {
        this._idnum = uniq_cntr++;
        this._inputPanelMarkup = args.inputPanelMarkup || '<div data-iopanel="input"></div>';
        this._outputPanelMarkup = args.outputPanelMarkup || '<div data-iopanel="output"></div>';
        this._baseSelectorMarkup = args.baseSelectorMarkup || help.baseSelectMarkupHTML;
        this._labelMarkup = args.labelMarkup || '<label></label>';
        this._buttonMarkup = args.buttonMarkup || '<input type="checkbox">';
        this._lampMarkup = args.lampMarkup || '<input type="checkbox">';
        this._rowMarkup = args.rowMarkup || '<div></div>';
        this._colMarkup = args.colMarkup || '<div></div>';
        this._inputMarkup = args.inputMarkup || '<input type="text">';
        this.render();
        this.listenTo(this.model._graph, 'add', this._handleAdd);
        this.listenTo(this.model._graph, 'remove', this._handleRemove);
    }
    render() {
        this.$el.html('<form>' + this._inputPanelMarkup + this._outputPanelMarkup + '</form>');
        for (const element of this.model.getInputCells())
            this._handleAddInput(element);
        for (const element of this.model.getOutputCells())
            this._handleAddOutput(element);
    }
    shutdown() {
        this.$el.off();
        this.stopListening();
    }
    _id(text) {
        return 'iopanel-' + text + '-' + this._idnum;
    }
    _handleAdd(cell) {
        if (cell.setLogicValue) this._handleAddInput(cell);
        else if (cell.getLogicValue) this.handleAddOutput(cell);
    }
    _addLabel(row, cell) {
        const label = $(this._labelMarkup)
            .appendTo(row);
        return label.find('label').addBack('label')
            .text(cell.get('net') || cell.get('label'));
    }
    _addLabelFor(row, cell) {
        return this._addLabel(row, cell)
            .attr('for', this._id(cell.id));
    }
    _handleAddInput(cell) {
        const row = $(this._rowMarkup)
            .appendTo(this.$('div[data-iopanel="input"]'));
        this._addLabelFor(row, cell);
        const col = $(this._colMarkup)
            .appendTo(row);
        if (cell.get('bits') == 1) {
            const ui = $(this._buttonMarkup)
                .appendTo(col);
            const inp = ui.find('input').addBack('input')
                .attr('id', this._id(cell.id))
                .on('click', (evt) => {
                    cell.setLogicValue(Vector3vl.fromBool(evt.target.checked));
                });
            const updater = (cell, sigs) => {
                inp.prop("checked", sigs.out.isHigh);
            };
            this.listenTo(cell, 'change:outputSignals', updater);
            updater(cell, cell.get('outputSignals'));
        } else {
            const ui = $(this._inputMarkup)
                .appendTo(col);
            let base = 'hex';
            const base_sel = $(this._baseSelectorMarkup(cell.get('bits'), base))
                .appendTo(col);
            let sz = display3vl.size(base, cell.get('bits'));
            const bits = cell.get('bits');
            const inp = ui.find('input').addBack('input')
                .prop('size', sz)
                .prop('maxlength', sz)
                .prop('pattern', display3vl.pattern(base))
                .on('change', (e) => {
                    if (!display3vl.validate(base, e.target.value, bits)) return;
                    cell.setLogicValue(display3vl.read(base, e.target.value, bits));
                });
            const updater = (cell, sigs) => {
                ui.val(display3vl.show(base, sigs.out));
            };
            this.listenTo(cell, 'change:outputSignals', updater);
            updater(cell, cell.get('outputSignals'));
            row.on('input', 'select[name=base]', (e) => {
                base = e.target.value;
                sz = display3vl.size(base, cell.get('bits'));
                inp.prop('size', sz)
                   .prop('maxlength', sz)
                   .prop('pattern', display3vl.pattern(base));
                updater(cell, cell.get('outputSignals'));
            });
        }
    }
    _handleAddOutput(cell) {
        const row = $(this._rowMarkup)
            .appendTo(this.$('div[data-iopanel="input"]'));
        this._addLabel(row, cell);
        const col = $(this._colMarkup)
            .appendTo(row);
        if (cell.get('bits') == 1) {
            const ui = $(this._lampMarkup)
                .appendTo(col);
            const inp = ui.find('input').addBack('input')
                .prop('disabled', true);
            const updater = (cell, sigs) => {
                const val = cell.getLogicValue();
                inp.prop("checked", val.isHigh);
                inp.prop("indeterminate", !val.isDefined);
            };
            this.listenTo(cell, 'change:inputSignals', updater);
            updater(cell, cell.get('inputSignals'));
        } else {
            const ui = $(this._inputMarkup)
                .appendTo(col);
            let base = 'hex';
            const base_sel = $(this._baseSelectorMarkup(cell.get('bits'), base))
                .appendTo(col);
            const sz = display3vl.size(base, cell.get('bits'));
            const inp = ui.find('input').addBack('input')
                .prop('disabled', true)
                .prop('size', sz);
//                .prop('maxlength', sz)
//                .prop('pattern', display3vl.pattern(base));
            const updater = (cell, sigs) => {
                const val = cell.getLogicValue();
                ui.val(display3vl.show(base, val));
            };
            this.listenTo(cell, 'change:inputSignals', updater);
            updater(cell, cell.get('inputSignals'));
            row.on('input', 'select[name=base]', (e) => {
                base = e.target.value;
                inp.prop('size', display3vl.size(base, cell.get('bits')));
                updater(cell, cell.get('inputSignals'));
            });
        }
    }
    _handleRemove(cell) {
        this.stopListening(cell);
    }
};

