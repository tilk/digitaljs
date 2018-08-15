"use strict";

import joint from 'jointjs';
import bigInt from 'big-integer';
import * as help from '@app/help.js';

// Things with numbers
joint.shapes.digital.Gate.define('digital.NumBase', {
    numbase: 'bin',
    attrs: {
        '.tooltip': {
            ref: '.body', 'ref-x': 0, 'ref-y': 0, 'y-alignment': 'bottom',
            width: 80, height: 30
        },
    }
}, {
    numbaseMarkup: [
        // requiredExtensions="http://www.w3.org/1999/xhtml" not supported by Chrome
        '<foreignObject class="tooltip">',
        '<body xmlns="http://www.w3.org/1999/xhtml">',
        '<select class="numbase">',
        '<option value="bin">bin</option>',
        '<option value="oct">oct</option>',
        '<option value="hex">hex</option>',
        '</select>',
        '</body></foreignObject>'].join('')
});
joint.shapes.digital.NumBaseView = joint.shapes.digital.GateView.extend({
    events: {
        "click select.numbase": "stopprop",
        "mousedown select.numbase": "stopprop",
        "change select.numbase": "changeNumbase"
    },
    changeNumbase: function(evt) {
        this.model.set('numbase', evt.target.value || 'bin');
    }
});

// Numeric display -- displays a number
joint.shapes.digital.NumBase.define('digital.NumDisplay', {
    bits: 1,
    attrs: {
        '.body': { fill: 'white', stroke: 'black', 'stroke-width': 2 },
        'text.value': { 
            text: '',
            fill: 'black',
            ref: '.body', 'ref-x': .5, 'ref-y': .5, 'y-alignment': 'middle',
            'text-anchor': 'middle',
            'font-size': '14px',
            'font-family': 'monospace'
        },
    }
}, {
    constructor: function(args) {
        if (!args.bits) args.bits = 1;
        this.markup = [
            '<g class="rotatable">',
            this.addWire(args, 'left', 0.5, { id: 'in', dir: 'in', bits: args.bits }),
            '<g class="scalable">',
            '<rect class="body"/>',
            '</g>',
            this.numbaseMarkup,
            '<text class="value"/>',
            '<text class="label"/>',
            '</g>'
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
});
joint.shapes.digital.NumDisplayView = joint.shapes.digital.NumBaseView;

// Numeric entry -- parses a number from a text box
joint.shapes.digital.NumBase.define('digital.NumEntry', {
    bits: 1,
    buttonState: [0],
    attrs: {
        '.body': { fill: 'white', stroke: 'black', 'stroke-width': 2 },
        'foreignObject.valinput': {
            ref: '.body', 'ref-x': 0.5, 'ref-y': 0.5,
            width: 60, height: 30,
            'x-alignment': 'middle', 'y-alignment': 'middle'
        }
    }
}, {
    constructor: function(args) {
        if (!args.bits) args.bits = 1;
        this.markup = [
            '<g class="rotatable">',
            this.addWire(args, 'right', 0.5, { id: 'out', dir: 'out', bits: args.bits }),
            '<g class="scalable">',
            '<rect class="body"/>',
            '</g>',
            this.numbaseMarkup,
            '<text class="label"/>',
            '<foreignObject class="valinput">',
            '<body xmlns="http://www.w3.org/1999/xhtml">',
            '<input type="text" />',
            '</body></foreignObject>',
            '</g>'
        ].join('');
        args.buttonState = args.outputSignals.out;
        joint.shapes.digital.NumBase.prototype.constructor.apply(this, arguments);
    },
    operation: function() {
        return { out: this.get('buttonState') };
    },
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

// Button model -- single-bit clickable input
joint.shapes.digital.Gate.define('digital.Button', {
    size: { width: 30, height: 30 },
    buttonState: false,
    attrs: {
        'rect.body': { fill: 'white', stroke: 'black', 'stroke-width': 2, width: 50, height: 50 },
        '.btnface': { 
            stroke: 'black', 'stroke-width': 2,
            'ref': '.body', 'ref-height': .8, 'ref-width': .8, 'ref-x': .5, 'ref-y': .5,
            'x-alignment': 'middle', 'y-alignment': 'middle',
            cursor: 'pointer'
        }
    }
}, {
    constructor: function(args) {
        this.markup = [
            '<g class="rotatable">',
            this.addWire(args, 'right', 0.5, { id: 'out', dir: 'out', bits: 1 }),
            '<g class="scalable">',
            '<rect class="body"/>',
            '<rect class="btnface"/>',
            '</g>',
            '<text class="label"/>',
            '</g>'
        ].join('');
        joint.shapes.digital.Gate.prototype.constructor.apply(this, arguments);
    },
    operation: function() {
        return { out: [this.get('buttonState') ? 1 : -1] };
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
    size: { width: 60, height: 30 },
    bits: 1,
    attrs: {
        '.body': { fill: 'white', stroke: 'black', 'stroke-width': 2 },
        text: {
            fill: 'black',
            ref: '.body', 'ref-x': .5, 'ref-y': .5, 'y-alignment': 'middle',
            'text-anchor': 'middle',
            'font-weight': 'bold',
            'font-size': '14px'
        }
    }
}, {
    constructor: function(args) {
        if (!args.bits) args.bits = 1;
        this.markup = [
            '<g class="rotatable">',
            this.addWire(args, this.io_dir == 'out' ? 'right' : 'left', 0.5, { id: this.io_dir, dir: this.io_dir, bits: args.bits }),
            '<g class="scalable">',
            '<rect class="body"/>',
            '</g>',
            '<text/>',
            '</g>'
        ].join('');
        if ('bits' in args) _.set(args, ['attrs', 'circle', 'port', 'bits'], args.bits);
        _.set(args, ['attrs', 'text', 'text'], args.net);
        joint.shapes.digital.Gate.prototype.constructor.apply(this, arguments);
    }
});

// Input model
joint.shapes.digital.IO.define('digital.Input', {
}, {
    io_dir: 'out'
});
joint.shapes.digital.InputView = joint.shapes.digital.GateView;

// Output model
joint.shapes.digital.IO.define('digital.Output', {
}, {
    io_dir: 'in'
});
joint.shapes.digital.OutputView = joint.shapes.digital.GateView;

// Constant
joint.shapes.digital.NumBase.define('digital.Constant', {
    attrs: {
        '.body': { fill: 'white', stroke: 'black', 'stroke-width': 2 },
        'text.value': { 
            text: '',
            fill: 'black',
            ref: '.body', 'ref-x': .5, 'ref-y': .5, 'y-alignment': 'middle',
            'text-anchor': 'middle',
            'font-size': '14px',
            'font-family': 'monospace'
        }
    }
}, {
    constructor: function(args) {
        args.outputSignals = { out: args.constant };
        this.markup = [
            '<g class="rotatable">',
            this.addWire(args, 'right', 0.5, { id: 'out', dir: 'out', bits: args.constant.length }),
            '<g class="scalable">',
            '<rect class="body"/>',
            '</g>',
            this.numbaseMarkup,
            '<text class="label" />',
            '<text class="value" />',
            '</g>'
        ].join('');
        joint.shapes.digital.NumBase.prototype.constructor.apply(this, arguments);
    },
    initialize: function(args) {
        joint.shapes.digital.NumBase.prototype.initialize.apply(this, arguments);
        const settext = () => {
            this.attr('text.value/text', help.sig2base(this.get('constant'), this.get('numbase')));
        }
        settext();
        this.listenTo(this, 'change:numbase', settext);
    },
    operation: function() {
        return { out: this.get('constant') };
    }
});
joint.shapes.digital.ConstantView = joint.shapes.digital.NumBaseView;

