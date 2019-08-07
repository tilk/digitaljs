"use strict";

import * as joint from 'jointjs';
import { Gate, GateView } from './base';
import _ from 'lodash';
import $ from 'jquery';
import bigInt from 'big-integer';
import * as help from '../help.js';
import { Vector3vl } from '3vl';

// Things with numbers
export const NumBase = Gate.define('NumBase', {
    numbase: 'hex',
    attrs: {
        '.tooltip': {
            'ref-x': 0, 'ref-y': -30,
            width: 80, height: 30
        },
    }
}, {
    initialize: function(args) {
        this.listenTo(this, 'change:size', (x, size) => {
            this.attr('.tooltip/width', Math.max(size.width, 50))
        });
        Gate.prototype.initialize.apply(this, arguments);
    },
    numbaseMarkup: [
        // requiredExtensions="http://www.w3.org/1999/xhtml" not supported by Chrome
        '<foreignObject class="tooltip">',
        '<body xmlns="http://www.w3.org/1999/xhtml">',
        '<select class="numbase">',
        '<option value="hex">hex</option>',
        '<option value="dec">dec</option>',
        '<option value="oct">oct</option>',
        '<option value="bin">bin</option>',
        '</select>',
        '</body></foreignObject>'].join(''),
    gateParams: Gate.prototype.gateParams.concat(['numbase'])
});
export const NumBaseView = GateView.extend({
    events: {
        "click select.numbase": "stopprop",
        "mousedown select.numbase": "stopprop",
        "change select.numbase": "changeNumbase"
    },
    changeNumbase: function(evt) {
        this.model.set('numbase', evt.target.value || 'bin');
    },
    render: function() {
        GateView.prototype.render.apply(this, arguments);
        if (this.model.get('box_resized')) return;
        this.model.set('box_resized', true);
        const testtext = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        $(testtext).text(Array(this.model.get('bits')).fill('0').join(''))
            .attr('class', 'numvalue')
            .appendTo(this.$el);
        const width = testtext.getBBox().width + 20;
        testtext.remove();
        this.model.set('size', _.set(_.clone(this.model.get('size')), 'width', width));
    }
});

// Numeric display -- displays a number
export const NumDisplay = NumBase.define('NumDisplay', {
    bits: 1,
    propagation: 0,
    attrs: {
        '.body': { fill: 'white', stroke: 'black', 'stroke-width': 2 },
        'text.value': { 
            text: '',
            'ref-x': .5, 'ref-y': .5,
            'dominant-baseline': 'ideographic',
        },
    }
}, {
    constructor: function(args) {
        if (!args.bits) args.bits = 1;
        this.markup = [
            this.addWire(args, 'left', 0.5, { id: 'in', dir: 'in', bits: args.bits }),
            '<rect class="body"/>',
            this.numbaseMarkup,
            '<text class="value numvalue"/>',
            '<text class="label"/>',
        ].join('');
        NumBase.prototype.constructor.apply(this, arguments);
    },
    initialize: function(args) {
        NumBase.prototype.initialize.apply(this, arguments);
        const settext = () => {
            this.attr('text.value/text', help.sig2base(this.get('inputSignals').in, this.get('numbase')));
        }
        settext();
        this.listenTo(this, 'change:inputSignals', settext);
        this.listenTo(this, 'change:numbase', settext);
    },
    gateParams: NumBase.prototype.gateParams.concat(['bits'])
});
export const NumDisplayView = NumBaseView;

// Numeric entry -- parses a number from a text box
export const NumEntry = NumBase.define('NumEntry', {
    bits: 1,
    propagation: 0,
    buttonState: Vector3vl.xes(1),
    attrs: {
        '.body': { fill: 'white', stroke: 'black', 'stroke-width': 2 },
        'foreignObject.valinput': {
            'ref-x': 5, 'ref-y': 0,
            width: 60, height: 30
        }
    }
}, {
    initialize: function(args) {
        this.listenTo(this, 'change:size', (x, size) => {
            this.attr('foreignObject.valinput/width', size.width - 10)
        });
        NumBase.prototype.initialize.apply(this, arguments);
    },
    constructor: function(args) {
        if (!args.bits) args.bits = 1;
        this.markup = [
            this.addWire(args, 'right', 0.5, { id: 'out', dir: 'out', bits: args.bits }),
            '<rect class="body"/>',
            this.numbaseMarkup,
            '<text class="label"/>',
            '<foreignObject class="valinput">',
            '<body xmlns="http://www.w3.org/1999/xhtml">',
            '<input type="text" class="numvalue" />',
            '</body></foreignObject>',
        ].join('');
        args.buttonState = args.outputSignals.out;
        NumBase.prototype.constructor.apply(this, arguments);
    },
    operation: function() {
        return { out: this.get('buttonState') };
    },
    gateParams: NumBase.prototype.gateParams.concat(['bits'])
});
export const NumEntryView = NumBaseView.extend({
    presentationAttributes: NumBaseView.addPresentationAttributes({
        buttonState: 'flag:buttonState',
        numbase: 'flag:buttonState'
    }),
    events: _.merge({
        "click input": "stopprop",
        "mousedown input": "stopprop",
        "change input": "change"
    }, NumBaseView.prototype.events),
    initialize(args) {
        NumBaseView.prototype.initialize.apply(this, arguments);
        this.settext();
    },
    confirmUpdate(flags) {
        NumBaseView.prototype.confirmUpdate.apply(this, arguments);
        if (this.hasFlag(flags, 'flag:buttonState')) this.settext();
    },
    settext() {
        this.$('input').val(help.sig2base(this.model.get('buttonState'), this.model.get('numbase')));
        this.$('input').removeClass('invalid');
    },
    change(evt) {
        const numbase = this.model.get('numbase');
        if (help.validNumber(evt.target.value, numbase)) {
            const val = help.base2sig(evt.target.value, this.model.get('bits'), numbase);
            this.model.set('buttonState', val);
        } else {
            this.$('input').addClass('invalid');
        }
    }
});

// Lamp model -- displays a single-bit input
export const Lamp = Gate.define('Lamp', {
    size: { width: 30, height: 30 },
    attrs: {
        'rect.body': { fill: 'white', stroke: 'black', 'stroke-width': 2, width: 30, height: 30 },
        '.led': {
            'ref-x': .5, 'ref-y': .5,
            r: 10
        }
    }
}, {
    constructor: function(args) {
        this.markup = [
            this.addWire(args, 'left', 0.5, { id: 'in', dir: 'in', bits: 1 }),
            '<rect class="body"/>',
            '<circle class="led"/>',
            '<text class="label"/>',
        ].join('')
        Gate.prototype.constructor.apply(this, arguments);
    }
});
export const LampView = GateView.extend({
    confirmUpdate(flags) {
        GateView.prototype.confirmUpdate.apply(this, arguments);
        if (this.hasFlag(flags, 'flag:inputSignals')) {
            this.updateLamp(this.model.get('inputSignals'));
        };
    },
    updateLamp(signal) {
        this.$(".led").toggleClass('live', signal.in.isHigh);
        this.$(".led").toggleClass('low', signal.in.isLow);
    },
    render() {
        GateView.prototype.render.apply(this, arguments);
        this.updateLamp(this.model.get('inputSignals'));
    }
});

// Button model -- single-bit clickable input
export const Button = Gate.define('Button', {
    size: { width: 30, height: 30 },
    buttonState: false,
    propagation: 0,
    attrs: {
        'rect.body': { fill: 'white', stroke: 'black', 'stroke-width': 2, width: 30, height: 30 },
        '.btnface': { 
            stroke: 'black', 'stroke-width': 2,
            'ref-height': .6, 'ref-width': .6, 'ref-x': .2, 'ref-y': .2,
            cursor: 'pointer'
        }
    }
}, {
    constructor: function(args) {
        this.markup = [
            this.addWire(args, 'right', 0.5, { id: 'out', dir: 'out', bits: 1 }),
            '<rect class="body"/>',
            '<rect class="btnface"/>',
            '<text class="label"/>',
        ].join('');
        Gate.prototype.constructor.apply(this, arguments);
    },
    operation: function() {
        return { out: this.get('buttonState') ? Vector3vl.ones(1) : Vector3vl.zeros(1) };
    }
});
export const ButtonView = GateView.extend({
    presentationAttributes: GateView.addPresentationAttributes({
        buttonState: 'flag:buttonState',
    }),
    initialize: function() {
        GateView.prototype.initialize.apply(this, arguments);
        this.$(".btnface").toggleClass('live', this.model.get('buttonState'));
    },
    confirmUpdate(flags) {
        GateView.prototype.confirmUpdate.apply(this, arguments);
        if (this.hasFlag(flags, 'flag:buttonState')) {
            this.$(".btnface").toggleClass('live', this.model.get('buttonState'));
        }
    },
    events: {
        "click .btnface": "activateButton",
        "mousedown .btnface": "stopprop"
    },
    activateButton() {
        this.model.set('buttonState', !this.model.get('buttonState'));
    },
});

// Input/output model
export const IO = Gate.define('IO', {
    bits: 1,
    propagation: 0,
    attrs: {
        '.body': { fill: 'white', stroke: 'black', 'stroke-width': 2 },
        text: {
            fill: 'black',
            'ref-x': .5, 'ref-y': .5, 'dominant-baseline': 'ideographic',
            'text-anchor': 'middle',
            'font-weight': 'bold',
            'font-size': '14px'
        }
    }
}, {
    constructor: function(args) {
        if (!args.bits) args.bits = 1;
        this.markup = [
            this.addWire(args, this.io_dir == 'out' ? 'right' : 'left', 0.5, { id: this.io_dir, dir: this.io_dir, bits: args.bits }),
            '<rect class="body"/>',
            '<text class="ioname"/>',
        ].join('');
        if ('bits' in args) _.set(args, ['attrs', 'circle', 'port', 'bits'], args.bits);
        _.set(args, ['attrs', 'text', 'text'], args.net);
        Gate.prototype.constructor.apply(this, arguments);
    },
    gateParams: Gate.prototype.gateParams.concat(['bits','net'])
});
export const IOView = GateView.extend({
    render: function() {
        GateView.prototype.render.apply(this, arguments);
        if (this.model.get('box_resized')) return;
        this.model.set('box_resized', true);
        const width = this.el.querySelector('text.ioname').getBBox().width + 10;
        this.model.set('size', _.set(_.clone(this.model.get('size')), 'width', width));
    }
});

// Input model
export const Input = IO.define('Input', {
}, {
    io_dir: 'out'
});
export const InputView = IOView;

// Output model
export const Output = IO.define('Output', {
}, {
    io_dir: 'in'
});
export const OutputView = IOView;

// Constant
export const Constant = NumBase.define('Constant', {
    propagation: 0,
    attrs: {
        '.body': { fill: 'white', stroke: 'black', 'stroke-width': 2 },
        'text.value': { 
            text: '',
            'ref-x': .5, 'ref-y': .5,
            'dominant-baseline': 'ideographic',
        }
    }
}, {
    constructor: function(args) {
        args.constantCache = Vector3vl.fromBin(args.constant, args.constant.length);
        args.bits = args.constant.length;
        args.outputSignals = { out: args.constantCache };
        this.markup = [
            this.addWire(args, 'right', 0.5, { id: 'out', dir: 'out', bits: args.constant.length }),
            '<rect class="body"/>',
            this.numbaseMarkup,
            '<text class="label" />',
            '<text class="value numvalue" />',
        ].join('');
        NumBase.prototype.constructor.apply(this, arguments);
    },
    initialize: function(args) {
        NumBase.prototype.initialize.apply(this, arguments);
        const settext = () => {
            this.attr('text.value/text', help.sig2base(this.get('constantCache'), this.get('numbase')));
        }
        settext();
        this.listenTo(this, 'change:numbase', settext);
    },
    operation: function() {
        return { out: this.get('constantCache') };
    },
    gateParams: NumBase.prototype.gateParams.concat(['constant'])
});
export const ConstantView = NumBaseView;

// Clock
export const Clock = Gate.define('Clock', {
    size: { width: 30, height: 30 },
    attrs: {
        'rect.body': { fill: 'white', stroke: 'black', 'stroke-width': 2, width: 30, height: 30 },
        'path.decor': { stroke: 'black' },
        '.tooltip': {
            'ref-x': 0, 'ref-y': -30,
            width: 80, height: 30
        },
    }
}, {
    constructor: function(args) {
        args.outputSignals = { out: Vector3vl.zeros(1) };
        this.markup = [
            this.addWire(args, 'right', 0.5, { id: 'out', dir: 'out', bits: 1 }),
            '<rect class="body"/>',
            '<path class="decor" d="M7.5 7.5 L7.5 22.5 L15 22.5 L15 7.5 L22.5 7.5 L22.5 22.5" />',
            '<text class="label" />',
            '<foreignObject class="tooltip">',
            '<body xmlns="http://www.w3.org/1999/xhtml">',
            '<input type="number" min="1" step="1" />',
            '</body></foreignObject>'
        ].join('');
        Gate.prototype.constructor.apply(this, arguments);
    },
    operation: function() {
        this.trigger("change:inputSignals", this, {});
        return { out: this.get('outputSignals').out.not() };
    }
});
export const ClockView = GateView.extend({
    presentationAttributes: GateView.addPresentationAttributes({
        propagation: 'flag:propagation'
    }),
    events: {
        "click input": "stopprop",
        "mousedown input": "stopprop",
        "change input": "changePropagation",
        "input input": "changePropagation"
    },
    render(args) {
        GateView.prototype.render.apply(this, arguments);
        this.updatePropagation();
    },
    confirmUpdate(flags) {
        GateView.prototype.confirmUpdate.apply(this, arguments);
        if (this.hasFlag(flags, 'flag:propagation')) this.updatePropagation();
    },
    changePropagation(evt) {
        const val = evt.target.value;
        const valid = String(val) == String(Number(val));
        if (valid) this.model.set('propagation', Number(val) || 1);
        this.$('input').toggleClass('invalid', !valid);
    },
    updatePropagation() {
        this.$('input').val(this.model.get('propagation'));
    }
});

