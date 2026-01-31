"use strict";

import * as joint from '@joint/core';
import $ from 'jquery';
import * as help from './help.mjs';
import { Vector3vl } from '3vl';
import { Waveform, drawWaveform, defaultSettings, extendSettings, calcGridStep } from 'wavecanvas';
import ResizeObserver from 'resize-observer-polyfill';

function getWireId(wire) {
    const hier = [wire.cid];
    for (let sc = wire.graph.get('subcircuit'); sc != null; sc = sc.graph.get('subcircuit')) {
        hier.push(sc.cid);
    }
    hier.reverse();
    return hier.join('.');
}

function getWireName(wire) {
    const hier = [];
    if (wire.has('netname')) hier.push(wire.get('netname'));
    else {
        const source = wire.source();
        hier.push(source.port);
        const cell = wire.graph.getCell(source.id);
        if (cell.has('label')) hier.push(cell.get('label'));
        else hier.push(source.id);
    }
    for (let sc = wire.graph.get('subcircuit'); sc != null; sc = sc.graph.get('subcircuit')) {
        if (sc.has('label')) hier.push(sc.get('label'));
        else hier.push(sc.id);
    }
    hier.reverse();
    return hier.join('.');
}

export class Monitor {
    constructor(circuit) {
        this._circuit = circuit;
        this._wires = new Map();
        this.listenTo(this._circuit, 'new:paper', (paper) => this.attachTo(paper));
    }
    attachTo(paper) {
        this.listenTo(paper, 'link:monitor', (linkView) => {
            this.addWire(linkView.model);
        });
    }
    addWire(wire) {
        const wireid = getWireId(wire);
        if (this._wires.has(wireid)) return;
        const waveform = new Waveform(wire.get('bits'));
        const obj = {wire: wire, waveform: waveform, monitorId: undefined};
        this._wires.set(wireid, obj);
        this.trigger('add', wire);
        obj.monitorId = this._circuit.monitorWire(wire, (tick, sig) => { this._handleChange(tick, wire, sig) });
    }
    removeWire(wire) {
        if (typeof wire == 'string') wire = this._wires.get(wire).wire;
        this.trigger('remove', wire);
        const wireid = getWireId(wire);
        this._circuit.unmonitor(this._wires.get(wireid).monitorId);
        this._wires.delete(wireid);
    }
    getWires() {
        const ret = [];
        for (const wobj of this._wires.values()) ret.push(wobj.wire);
        return ret;
    }
    getWiresDesc() {
        return this.getWires().map(wire => {
            if (!wire.has('netname')) return;
            return {
                name: wire.get('netname'),
                path: wire.getWirePath(),
                bits: wire.get('bits')
            };
        }).filter(x => x !== undefined);
    }
    loadWiresDesc(wd) {
        for (const w of wd) {
            const e = this._circuit.findWireByLabel(w.name, w.path);
            if (e && e.get('bits') == w.bits) this.addWire(e);
        }
    }
    _handleChange(tick, wire, signal) {
        this._wires.get(getWireId(wire)).waveform.push(tick, signal);
        this.trigger('change', wire, signal);
    }
}

joint.util.assign(Monitor.prototype, joint.mvc.Events);

export class MonitorView extends joint.mvc.View {
    initialize(args) {
        this._width = 800;
        this._settings = extendSettings(defaultSettings, {start: 0, pixelsPerTick: 5, gridStep: 1});
        this._settingsFor = new Map();
        this._live = true;
        this._autoredraw = false;
        this._idle = null;
        this._removeButtonMarkup = args.removeButtonMarkup || '<button type="button" name="remove">✖</button>';
        this._baseSelectorMarkup = args.baseSelectorMarkup || help.baseSelectMarkupHTML;
        this._bitTriggerMarkup = args.bitTriggerMarkup || '<select name="trigger" title="Trigger"><option value="none"></option><option value="rising">↑</option><option value="falling">↓</option><option value="risefall">↕</option><option value="undef">x</option></select>';
        this._busTriggerMarkup = args.busTriggerMarkup || '<input type="text" name="trigger" title="Trigger" placeholder="trigger" pattern="[0-9a-fx]*">';
        this.listenTo(this.model, 'add', this._handleAdd);
        this.listenTo(this.model, 'remove', this._handleRemove);
        this.listenTo(this.model._circuit, "display:add", () => { this.render() });
        this.listenTo(this.model._circuit, 'postUpdateGates', (tick) => {
            if (this._live) this.start = tick - this._width / this._settings.pixelsPerTick;
            this._settings.present = tick;
            if (!this._idle) this._idle = requestIdleCallback(() => {
                this._drawAll();
                this._idle = null;
            }, {timeout: 100});
        });
        this.render();
        this._resizeObserver = new ResizeObserver(() => {
            this._canvasResize();
        });
        this._resizeObserver.observe(this.el);
        function evt_wireid(e) {
            return $(e.target).closest('tr').attr('wireid');
        }
        const display3vl = this.model._circuit._display3vl;
        this.$el.on('click', 'button[name=remove]', (e) => { this.model.removeWire(evt_wireid(e)); });
        this.$el.on('input', 'select[name=base]', (e) => { 
            const base = e.target.value;
            const settings = this._settingsFor.get(evt_wireid(e));
            settings.base = base;
            const row = $(e.target).closest('tr');
            const trig = row.find('input[name=trigger]');
            trig.attr('pattern', display3vl.pattern(base));
            if (settings.trigger.length)
                trig.val(display3vl.show(base, settings.trigger[0]));
            this.trigger('change');
        });
        const handleTrigger = () => {
            return true;
        };
        const setTrigger = (wireid, triggers) => {
            const settings = this._settingsFor.get(wireid);
            if (settings.triggerId) {
                this.model._circuit.unmonitor(settings.triggerId);
                settings.triggerId = null;
            }
            if (triggers.length > 0) {
                const wire = this.model._wires.get(wireid).wire;
                settings.triggerId = this.model._circuit.monitorWire(wire, handleTrigger, {triggerValues: triggers, stopOnTrigger: true});
            }
            settings.trigger = triggers;
        }
        this.$el.on('input', 'select[name=trigger]', (e) => {
            const wireid = evt_wireid(e);
            switch (e.target.value) {
                case 'rising': setTrigger(wireid, [Vector3vl.one]); break;
                case 'falling': setTrigger(wireid, [Vector3vl.zero]); break;
                case 'risefall': setTrigger(wireid, [Vector3vl.one, Vector3vl.zero]); break;
                case 'undef': setTrigger(wireid, [Vector3vl.x]); break;
                default: setTrigger(wireid, []);
            }
        });
        this.$el.on('change', 'input[name=trigger]', (e) => {
            const wireid = evt_wireid(e);
            const settings = this._settingsFor.get(wireid);
            const base = settings.base;
            const bits = this.model._wires.get(wireid).waveform.bits;
            if (e.target.value == "") {
                setTrigger(wireid, []);
            } else if (display3vl.validate(base, e.target.value, bits)) {
                const val = display3vl.read(base, e.target.value, bits);
                setTrigger(wireid, [val]);
                e.target.value = display3vl.show(base, val);
            } else {
                setTrigger(wireid, []);
            }
        });
        this.listenTo(this, 'change', () => { if (this._autoredraw) this._drawAll() });

        const dragImg = new Image(0,0);
        dragImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        let dragX, dragStart;
        const do_drag = (e) => {
            const offset = e.originalEvent.screenX - dragX;
            this.start = dragStart - offset / this._settings.pixelsPerTick;
        };
        this.$el.on('dragstart', 'canvas', (e) => {
            const dt = e.originalEvent.dataTransfer;
            dt.setData('text/plain', 'dragging'); 
            dt.setDragImage(dragImg, 0, 0);
            dragX = e.originalEvent.screenX;
            dragStart = this._settings.start;
            this.live = false;
            $(document).on('dragover', do_drag);
        });
        this.$el.on('dragend', 'canvas', (e) => {
            $(document).off('dragover', do_drag);
        });
        this.$el.on('wheel', 'canvas', (e) => {
            e.preventDefault();
            const scaling = 2 ** Math.sign(e.originalEvent.deltaY);
            this.start += e.originalEvent.offsetX / this._settings.pixelsPerTick * (1 - 1 / scaling);
            this.pixelsPerTick *= scaling;
        });
    }
    render() {
        this.$el.html('<table class="monitor"></table>');
        for (const wobj of this.model._wires.values()) {
            this.$('table').append(this._handleAdd(wobj.wire));
        }
        this._canvasResize();
        return this;
    }
    shutdown() {
        this.$el.off();
        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
            this._resizeObserver = undefined;
        }
        this.stopListening();
    }
    get gridStep() {
        return calcGridStep(this._settings);
    }
    get autoredraw() {
        return this._autoredraw;
    }
    set autoredraw(val) {
        this._autoredraw = val;
        if (val) this._drawAll();
    }
    get width() {
        return this._width;
    }
    get live() {
        return this._live;
    }
    set live(val) {
        if (this.live == val) return;
        this._live = val;
        this.trigger('change:live', val);
        this.trigger('change');
    }
    get start() {
        return this._settings.start;
    }
    set start(val) {
        if (this._settings.start == val) return;
        this._settings.start = val;
        this.trigger('change:start', val);
        this.trigger('change');
    }
    get pixelsPerTick() {
        return this._settings.pixelsPerTick;
    }
    set pixelsPerTick(val) {
        if (this._settings.pixelsPerTick == val) return;
        this._settings.pixelsPerTick = val;
        this.trigger('change:pixelsPerTick', val);
        this.trigger('change');
    }
    _canvasResize() {
        this._width = Math.max(this.$el.width() - 300, 100);
        this.$('canvas').attr('width', this._width);
        this.trigger('change:width', this._width);
        this.trigger('change');
    }
    _drawAll() {
        for (const wireid of this.model._wires.keys()) {
            this._draw(wireid);
        }
    }
    _draw(wireid) {
        const display3vl = this.model._circuit._display3vl;
        const canvas = this.$('tr[wireid="'+wireid+'"]').find('canvas');
        const waveform = this.model._wires.get(wireid).waveform;
        drawWaveform(waveform, canvas[0].getContext('2d'), this._settingsFor.get(wireid), display3vl);
    }
    _handleAdd(wire) {
        const wireid = getWireId(wire);
        this._settingsFor.set(wireid, extendSettings(this._settings, {base: 'hex', trigger: [], triggerId: null}));
        this.$('table').append(this._createRow(wire));
    }
    _handleRemove(wire) {
        const wireid = getWireId(wire);
        this.$('tr[wireid="'+wireid+'"]').remove();
        const settings = this._settingsFor.get(wireid);
        if (settings.triggerId) 
            this.model._circuit.unmonitor(settings.triggerId);
        this._settingsFor.delete(wireid);
    }
    _createRow(wire) {
        const wireid = getWireId(wire);
        const settings = this._settingsFor.get(wireid);
        const display3vl = this.model._circuit._display3vl;
        const base_sel = wire.get('bits') > 1 
            ? (this._baseSelectorMarkup instanceof Function ? this._baseSelectorMarkup(display3vl, wire.get('bits'), settings.base) : this._baseSelectorMarkup) 
            : '';
        const trigger = wire.get('bits') > 1 ? this._busTriggerMarkup : this._bitTriggerMarkup;
        const row = $('<tr><td class="name"></td><td>'+base_sel+'</td><td>'+trigger+'</td><td>'+this._removeButtonMarkup+'</td><td><canvas class="wavecanvas" height="30" draggable="true"></canvas></td></tr>');
        row.attr('wireid', wireid);
        row.children('td').first().text(getWireName(wire));
        return row;
    }
}
