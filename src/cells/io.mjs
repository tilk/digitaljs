"use strict";

import * as joint from 'jointjs';
import { Box, BoxView } from './base';
import _ from 'lodash';
import $ from 'jquery';
import bigInt from 'big-integer';
import { display3vl } from '../help.mjs';
import { Vector3vl } from '3vl';

// Things with numbers
export const NumBase = Box.define('NumBase', {
    /* default properties */
    numbase: 'hex',
    bits: 1
}, {
    initialize: function(args) {
        Box.prototype.initialize.apply(this, arguments);

        this.on('change:bits', (_, bits) => {
            const displays = display3vl.usableDisplays(this.numbaseType, this.get('bits'));
            if (!displays.includes(this.get('numbase')))
                this.set('numbase', 'hex');
        });
    },
    tooltipMinWidth: 70,
    markup: Box.prototype.markup.concat([{
            tagName: 'foreignObject',
            className: 'tooltip',
            children: [{
                tagName: 'body',
                namespaceURI: 'http://www.w3.org/1999/xhtml',
                children: [{
                    tagName: 'select',
                    className: 'numbase'
                }]
            }]
        }
    ]),
    gateParams: Box.prototype.gateParams.concat(['numbase'])
});
export const NumBaseView = BoxView.extend({
    presentationAttributes: BoxView.addPresentationAttributes({
        bits: 'flag:bits',
        numbase: 'flag:numbase'
    }),
    autoResizeBox: true,
    events: {
        "click select.numbase": "stopprop",
        "mousedown select.numbase": "stopprop",
        "change select.numbase": "changeNumbase"
    },
    changeNumbase: function(evt) {
        this.model.set('numbase', evt.target.value || 'bin');
    },
    calculateBoxWidth: function() {
        const testtext = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        $(testtext).text(Array(this.model.get('bits')).fill('0').join(''))
            .attr('class', 'numvalue')
            .appendTo(this.$el);
        const width = testtext.getBBox().width + 20;
        testtext.remove();
        return width;
    },
    confirmUpdate(flags) {
        BoxView.prototype.confirmUpdate.apply(this, arguments);
        if (this.hasFlag(flags, 'flag:bits') || this.hasFlag(flags, 'RENDER'))
            this.makeNumBaseSelector();
        if (this.hasFlag(flags, 'flag:numbase'))
            this.updateNumBaseSelector();
    },
    makeNumBaseSelector() {
        this.$('select.numbase').empty();
        const numbase = this.model.get('numbase');
        for (const base of display3vl.usableDisplays(this.model.numbaseType, this.model.get('bits'))) {
            const opt = $('<option>')
                .attr('value', base)
                .prop('selected', base == numbase)
                .text(base)
                .appendTo(this.$('select.numbase'));
        }
    },
    updateNumBaseSelector() {
        this.$('select.numbase').val(this.model.get('numbase'));
    }
});

// Numeric display -- displays a number
export const NumDisplay = NumBase.define('NumDisplay', {
    /* default properties */
    bits: 1,
    propagation: 0,
    
    attrs: {
        'text.value': { 
            refX: .5, refY: .5,
            textVerticalAnchor: 'middle'
        },
    }
}, {
    initialize: function(args) {
        NumBase.prototype.initialize.apply(this, arguments);
        
        const bits = this.get('bits');
        
        this.addPort({ id: 'in', group: 'in', dir: 'in', bits: bits });
        
        this.on('change:bits', (_, bits) => {
            this.setPortBits('in', bits);
        });

        const settext = () => this.attr('text.value/text', display3vl.show(this.get('numbase'), this.get('inputSignals').in));
        settext();
        
        this.on('change:inputSignals change:numbase', settext);
    },
    markup: NumBase.prototype.markup.concat([{
            tagName: 'text',
            className: 'value numvalue'
        }
    ]),
    getLogicValue: function() {
        return this.get('inputSignals').in;
    },
    gateParams: NumBase.prototype.gateParams.concat(['bits']),
    numbaseType: 'show'
});
export const NumDisplayView = NumBaseView;

// Numeric entry -- parses a number from a text box
export const NumEntry = NumBase.define('NumEntry', {
    /* default properties */
    bits: 1,
    propagation: 0,
    buttonState: Vector3vl.xes(1),
    
    attrs: {
        'foreignObject.valinput': {
            refX: .5, refY: .5,
            refWidth: -10, refHeight: -10,
            xAlignment: 'middle', yAlignment: 'middle',
        }
    }
}, {
    initialize: function(args) {
        NumBase.prototype.initialize.apply(this, arguments);
        
        const bits = this.get('bits');
        
        this.addPort({ id: 'out', group: 'out', dir: 'out', bits: bits });
        
        this.on('change:bits', (_, bits) => {
            this.setPortBits('out', bits);
        });
        
        this.set('buttonState', this.get('outputSignals').out);
    },
    operation: function() {
        return { out: this.get('buttonState') };
    },
    markup: NumBase.prototype.markup.concat([{
            tagName: 'foreignObject',
            className: 'valinput',
            children: [{
                tagName: 'body',
                namespaceURI: 'http://www.w3.org/1999/xhtml',
                children: [{
                    tagName: 'input',
                    attributes: { type: 'text' }
                }]
            }]
        }
    ]),
    setLogicValue: function(sig) {
        console.assert(sig.bits == this.get('bits'));
        this.set('buttonState', sig);
    },
    gateParams: NumBase.prototype.gateParams.concat(['bits']),
    numbaseType: 'read'
});
export const NumEntryView = NumBaseView.extend({
    presentationAttributes: NumBaseView.addPresentationAttributes({
        buttonState: 'flag:buttonState'
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
        if (this.hasFlag(flags, 'flag:buttonState') ||
            this.hasFlag(flags, 'flag:numbase')) this.settext();
    },
    settext() {
        this.$('input').val(display3vl.show(this.model.get('numbase'), this.model.get('buttonState')));
        this.$('input').removeClass('invalid');
    },
    change(evt) {
        const numbase = this.model.get('numbase');
        if (display3vl.validate(numbase, evt.target.value)) {
            const val = display3vl.read(numbase, evt.target.value, this.model.get('bits'));
            this.model.set('buttonState', val);
        } else {
            this.$('input').addClass('invalid');
        }
    }
});

// Lamp model -- displays a single-bit input
export const Lamp = Box.define('Lamp', {
    size: { width: 30, height: 30 },
    attrs: {
        '.led': {
            refX: .5, refY: .5,
            refR: .35,
            stroke: 'black'
        }
    }
}, {
    initialize: function(args) {
        Box.prototype.initialize.apply(this, arguments);
        this.addPort({ id: 'in', group: 'in', dir: 'in', bits: 1 });
    },
    markup: Box.prototype.markup.concat([{
            tagName: 'circle',
            className: 'led'
        }
    ]),
    getLogicValue: function() {
        return this.get('inputSignals').in;
    }
});
export const LampView = BoxView.extend({
    confirmUpdate(flags) {
        BoxView.prototype.confirmUpdate.apply(this, arguments);
        if (this.hasFlag(flags, 'flag:inputSignals')) {
            this.updateLamp(this.model.get('inputSignals'));
        };
    },
    updateLamp(signal) {
        this.$(".led").toggleClass('live', signal.in.isHigh);
        this.$(".led").toggleClass('low', signal.in.isLow);
    },
    render() {
        BoxView.prototype.render.apply(this, arguments);
        this.updateLamp(this.model.get('inputSignals'));
    }
});

// Button model -- single-bit clickable input
export const Button = Box.define('Button', {
    /* default properties */
    buttonState: false,
    propagation: 0,
    
    size: { width: 30, height: 30 },
    attrs: {
        '.btnface': { 
            stroke: 'black', strokeWidth: 2,
            refX: .2, refY: .2,
            refHeight: .6, refWidth: .6,
            cursor: 'pointer'
        }
    }
}, {
    initialize: function(args) {
        Box.prototype.initialize.apply(this, arguments);
        this.addPort({ id: 'out', group: 'out', dir: 'out', bits: 1 });
    },
    operation: function() {
        return { out: this.get('buttonState') ? Vector3vl.ones(1) : Vector3vl.zeros(1) };
    },
    markup: Box.prototype.markup.concat([{
            tagName: 'rect',
            className: 'btnface'
        }
    ]),
    setLogicValue: function(sig) {
        this.set('buttonState', sig.isHigh);
    }
});
export const ButtonView = BoxView.extend({
    presentationAttributes: BoxView.addPresentationAttributes({
        buttonState: 'flag:buttonState',
    }),
    initialize: function() {
        BoxView.prototype.initialize.apply(this, arguments);
        this.$(".btnface").toggleClass('live', this.model.get('buttonState'));
    },
    confirmUpdate(flags) {
        BoxView.prototype.confirmUpdate.apply(this, arguments);
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
export const IO = Box.define('IO', {
    /* default properties */
    bits: 1,
    net: '',
    propagation: 0,
    
    attrs: {
        'text.ioname': {
            refX: .5, refY: .5,
            textAnchor: 'middle', textVerticalAnchor: 'middle',
            fontWeight: 'bold',
            fontSize: '10pt'
        }
    }
}, {
    initialize: function(args) {
        Box.prototype.initialize.apply(this, arguments);
        
        const bits = this.get('bits');
        
        this.addPort({ id: this.io_dir, group: this.io_dir, dir: this.io_dir, bits: bits });
        
        this.on('change:bits', (_, bits) => {
            this.setPortBits(this.io_dir, bits);
        });
        this.bindAttrToProp('text.ioname/text', 'net');
    },
    markup: Box.prototype.markup.concat([{
            tagName: 'text',
            className: 'ioname'
        }
    ]),
    gateParams: Box.prototype.gateParams.concat(['bits','net'])
});
export const IOView = BoxView.extend({
    autoResizeBox: true,
    calculateBoxWidth: function() {
        const text = this.el.querySelector('text.ioname');
        if (text.getAttribute('display') !== 'none') return text.getBBox().width + 10;
        return 20;
    }
});

// Input model
export const Input = IO.define('Input', {
}, {
    io_dir: 'out',
    setLogicValue: function(sig) {
        console.assert(sig.bits == this.get('bits'));
        this.set('outputSignals', { out: sig });
    }
});
export const InputView = IOView;

// Output model
export const Output = IO.define('Output', {
}, {
    io_dir: 'in',
    getLogicValue: function() {
        return this.get('inputSignals').in;
    }
});
export const OutputView = IOView;

// Constant
export const Constant = NumBase.define('Constant', {
    /* default properties */
    constant: '0',
    propagation: 0,
    
    attrs: {
        'text.value': {
            refX: .5, refY: .5,
            textVerticalAnchor: 'middle'
        }
    }
}, {
    initialize: function(args) {
        NumBase.prototype.initialize.apply(this, arguments);
        
        const constant = this.get('constant');
        this.set('bits', constant.length);
        this.set('constantCache', Vector3vl.fromBin(constant, constant.length));
        
        this.addPort({ id: 'out', group: 'out', dir: 'out', bits: constant.length });
        
        const settext = () => this.attr('text.value/text', display3vl.show(this.get('numbase'), this.get('constantCache')));
        settext();
        
        this.on('change:constant', (_, constant) => {
            this.setPortBits('out', constant.length);
            this.set('bits', constant.length);
            this.set('constantCache', Vector3vl.fromBin(constant, constant.length));
            settext();
        });
        this.on('change:numbase', settext);
    },
    operation: function() {
        return { out: this.get('constantCache') };
    },
    markup: NumBase.prototype.markup.concat([{
            tagName: 'text',
            className: 'value numvalue'
        }
    ]),
    gateParams: NumBase.prototype.gateParams.concat(['constant']),
    numbaseType: 'show'
});
export const ConstantView = NumBaseView;

// Clock
export const Clock = Box.define('Clock', {
    /* default properties */
    propagation: 100,
    
    size: { width: 30, height: 30 }
}, {
    initialize: function(args) {
        Box.prototype.initialize.apply(this, arguments);
        
        this.addPort({ id: 'out', group: 'out', dir: 'out', bits: 1 });
        
        this.set('outputSignals', { out: Vector3vl.zeros(1) });
    },
    operation: function() {
        // trigger next clock edge
        this.trigger("change:inputSignals", this, {});
        return { out: this.get('outputSignals').out.not() };
    },
    tooltipMinWidth: 55,
    markup: Box.prototype.markup.concat([{
            tagName: 'path',
            className: 'decor',
            attributes: { d: 'M7.5 7.5 L7.5 22.5 L15 22.5 L15 7.5 L22.5 7.5 L22.5 22.5', stroke: 'black' }
        }, {
            tagName: 'foreignObject',
            className: 'tooltip',
            children: [{
                tagName: 'body',
                namespaceURI: 'http://www.w3.org/1999/xhtml',
                children: [{
                    tagName: 'input',
                    attributes: { type: 'number', min: 1, step: 1 }
                }]
            }]
        }
    ])
});
export const ClockView = BoxView.extend({
    presentationAttributes: BoxView.addPresentationAttributes({
        propagation: 'flag:propagation'
    }),
    events: {
        "click input": "stopprop",
        "mousedown input": "stopprop",
        "change input": "changePropagation",
        "input input": "changePropagation"
    },
    render(args) {
        BoxView.prototype.render.apply(this, arguments);
        this.updatePropagation();
    },
    confirmUpdate(flags) {
        BoxView.prototype.confirmUpdate.apply(this, arguments);
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

