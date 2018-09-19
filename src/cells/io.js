"use strict";

import joint from 'jointjs';
import _ from 'lodash';
import bigInt from 'big-integer';
import * as help from '@app/help.js';
import { Vector3vl } from '3vl';

// Things with numbers
joint.shapes.digital.Gate.define('digital.NumBase', {
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
        joint.shapes.digital.Gate.prototype.initialize.apply(this, arguments);
    },
    numbaseMarkup: [
        // requiredExtensions="http://www.w3.org/1999/xhtml" not supported by Chrome
        '<foreignObject class="tooltip">',
        '<body xmlns="http://www.w3.org/1999/xhtml">',
        '<select class="numbase">',
        '<option value="hex">hex</option>',
        '<option value="oct">oct</option>',
        '<option value="bin">bin</option>',
        '</select>',
        '</body></foreignObject>'].join(''),
    gateParams: joint.shapes.digital.Gate.prototype.gateParams.concat(['numbase'])
});
joint.shapes.digital.NumBaseView = joint.shapes.digital.GateView.extend({
    events: {
        "click select.numbase": "stopprop",
        "mousedown select.numbase": "stopprop",
        "change select.numbase": "changeNumbase"
    },
    changeNumbase: function(evt) {
        this.model.set('numbase', evt.target.value || 'bin');
    },
    render: function() {
        joint.shapes.digital.GateView.prototype.render.apply(this, arguments);
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
joint.shapes.digital.NumBase.define('digital.NumDisplay', {
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
        joint.shapes.digital.NumBase.prototype.constructor.apply(this, arguments);
    },
    initialize: function(args) {
        joint.shapes.digital.NumBase.prototype.initialize.apply(this, arguments);
        const settext = () => {
            this.attr('text.value/text', help.sig2base(this.get('inputSignals').in, this.get('numbase')));
        }
        settext();
        this.listenTo(this, 'change:inputSignals', settext);
        this.listenTo(this, 'change:numbase', settext);
    },
    gateParams: joint.shapes.digital.NumBase.prototype.gateParams.concat(['bits'])
});
joint.shapes.digital.NumDisplayView = joint.shapes.digital.NumBaseView;

// Numeric entry -- parses a number from a text box
joint.shapes.digital.NumBase.define('digital.NumEntry', {
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
        joint.shapes.digital.NumBase.prototype.initialize.apply(this, arguments);
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
        joint.shapes.digital.NumBase.prototype.constructor.apply(this, arguments);
    },
    operation: function() {
        return { out: this.get('buttonState') };
    },
    gateParams: joint.shapes.digital.NumBase.prototype.gateParams.concat(['bits'])
});
joint.shapes.digital.NumEntryView = joint.shapes.digital.NumBaseView.extend({
    events: _.merge({
        "click input": "stopprop",
        "mousedown input": "stopprop",
        "change input": "change"
    }, joint.shapes.digital.NumBaseView.prototype.events),
    initialize: function(args) {
        joint.shapes.digital.NumBaseView.prototype.initialize.apply(this, arguments);
        const settext = () => {
            this.$('input').val(help.sig2base(this.model.get('buttonState'), this.model.get('numbase')));
            this.$('input').removeClass('invalid');
        };
        settext();
        this.listenTo(this.model, 'change:buttonState', settext);
        this.listenTo(this.model, 'change:numbase', settext);
    },
    change: function(evt) {
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
joint.shapes.digital.Gate.define('digital.Lamp', {
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
        joint.shapes.digital.Gate.prototype.constructor.apply(this, arguments);
    }
});
joint.shapes.digital.LampView = joint.shapes.digital.GateView.extend({
    initialize: function() {
        joint.shapes.digital.GateView.prototype.initialize.apply(this, arguments);
        this.listenTo(this.model, 'change:inputSignals', (wire, signal) => { this.updateLamp(signal) });
    },
    updateLamp: function(signal) {
        this.$(".led").toggleClass('live', signal.in.isHigh);
        this.$(".led").toggleClass('low', signal.in.isLow);
    },
    render: function() {
        joint.shapes.digital.GateView.prototype.render.apply(this, arguments);
        this.updateLamp(this.model.get('inputSignals'));
    }
});

// Button model -- single-bit clickable input
joint.shapes.digital.Gate.define('digital.Button', {
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
        joint.shapes.digital.Gate.prototype.constructor.apply(this, arguments);
    },
    operation: function() {
        return { out: this.get('buttonState') ? Vector3vl.ones(1) : Vector3vl.zeros(1) };
    }
});
joint.shapes.digital.ButtonView = joint.shapes.digital.GateView.extend({
    initialize: function() {
        joint.shapes.digital.GateView.prototype.initialize.apply(this, arguments);
        this.$(".btnface").toggleClass('live', this.model.get('buttonState'));
        this.listenTo(this.model, 'change:buttonState', function(wire, signal) {
            this.$(".btnface").toggleClass('live', signal);
        });
    },
    events: {
        "click .btnface": "activateButton",
        "mousedown .btnface": "stopprop"
    },
    activateButton: function() {
        this.model.set('buttonState', !this.model.get('buttonState'));
    },
});

// Input/output model
joint.shapes.digital.Gate.define('digital.IO', {
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
        joint.shapes.digital.Gate.prototype.constructor.apply(this, arguments);
    },
    gateParams: joint.shapes.digital.Gate.prototype.gateParams.concat(['bits'])
});
joint.shapes.digital.IOView = joint.shapes.digital.GateView.extend({
    render: function() {
        joint.shapes.digital.GateView.prototype.render.apply(this, arguments);
        if (this.model.get('box_resized')) return;
        this.model.set('box_resized', true);
        const width = this.el.querySelector('text.ioname').getBBox().width + 10;
        this.model.set('size', _.set(_.clone(this.model.get('size')), 'width', width));
    }
});

// Input model
joint.shapes.digital.IO.define('digital.Input', {
}, {
    io_dir: 'out'
});
joint.shapes.digital.InputView = joint.shapes.digital.IOView;

// Output model
joint.shapes.digital.IO.define('digital.Output', {
}, {
    io_dir: 'in'
});
joint.shapes.digital.OutputView = joint.shapes.digital.IOView;

// Constant
joint.shapes.digital.NumBase.define('digital.Constant', {
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
        args.bits = args.constant.bits;
        args.outputSignals = { out: args.constantCache };
        this.markup = [
            this.addWire(args, 'right', 0.5, { id: 'out', dir: 'out', bits: args.constant.length }),
            '<rect class="body"/>',
            this.numbaseMarkup,
            '<text class="label" />',
            '<text class="value numvalue" />',
        ].join('');
        joint.shapes.digital.NumBase.prototype.constructor.apply(this, arguments);
    },
    initialize: function(args) {
        joint.shapes.digital.NumBase.prototype.initialize.apply(this, arguments);
        const settext = () => {
            this.attr('text.value/text', help.sig2base(this.get('constantCache'), this.get('numbase')));
        }
        settext();
        this.listenTo(this, 'change:numbase', settext);
    },
    operation: function() {
        return { out: this.get('constantCache') };
    },
    gateParams: joint.shapes.digital.NumBase.prototype.gateParams.concat(['constant'])
});
joint.shapes.digital.ConstantView = joint.shapes.digital.NumBaseView;

// Clock
joint.shapes.digital.Gate.define('digital.Clock', {
    size: { width: 30, height: 30 },
    attrs: {
        'rect.body': { fill: 'white', stroke: 'black', 'stroke-width': 2, width: 30, height: 30 },
        'path.decor': { stroke: 'black' }
    }
}, {
    constructor: function(args) {
        args.outputSignals = { out: Vector3vl.zeros(1) };
        this.markup = [
            this.addWire(args, 'right', 0.5, { id: 'out', dir: 'out', bits: 1 }),
            '<rect class="body"/>',
            '<path class="decor" d="M7.5 7.5 L7.5 22.5 L15 22.5 L15 7.5 L22.5 7.5 L22.5 22.5" />',
            '<text class="label" />',
        ].join('');
        joint.shapes.digital.Gate.prototype.constructor.apply(this, arguments);
    },
    operation: function() {
        this.trigger("change:inputSignals", this, {});
        return { out: this.get('outputSignals').out.not() };
    }
});

