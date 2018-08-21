"use strict";

import joint from 'jointjs';
import bigInt from 'big-integer';
import * as help from '@app/help.js';

// Common base class for gate models
joint.shapes.basic.Generic.define('digital.Gate', {
    size: { width: 80, height: 30 },
    inputSignals: {},
    outputSignals: {},
    propagation: 1,
    attrs: {
        '.': { magnet: false },
        'rect.body': { width: 80, height: 30 },
        'circle[port]': { r: 7, stroke: 'black', fill: 'transparent', 'stroke-width': 2 },
        'text.label': {
            text: '', ref: '.body', 'ref-x': 0.5, 'ref-dy': 2, 'x-alignment': 'middle', 
            fill: 'black'
        },
        'text.bits': {
            fill: 'black'
        }
    }
}, {
    operation: function() {
        return {};
    },
    constructor: function(args) {
        if ('label' in args) _.set(args, ['attrs', 'text.label', 'text'], args.label);
        joint.shapes.basic.Generic.prototype.constructor.apply(this, arguments);
    },
    initialize: function() {
        joint.shapes.basic.Generic.prototype.initialize.apply(this, arguments);
        this.updatePortSignals('in', this.get('inputSignals'));
        this.updatePortSignals('out', this.get('outputSignals'));
        this.listenTo(this, 'change:inputSignals', function(wire, signal) {
            this.updatePortSignals('in', signal);
        });
        this.listenTo(this, 'change:outputSignals', function(wire, signal) {
            this.updatePortSignals('out', signal);
        });
    },
    updatePortSignals: function(dir, signal) {
        for (const portname in this.ports) {
            const port = this.ports[portname];
            if (port.dir !== dir) continue;
            let classes = [port.dir, 'port_' + port.id];
            classes.push(help.sigClass(signal[port.id]));
            this.attr("[port='" + port.id + "']/class", classes.join(' '));
        }
    },
    addWire: function(args, side, loc, port) {
        const vert = side == 'top';
        const wire_args = {
            ref: 'circle.port_' + port.id, 'ref-y': .5, 'ref-x': .5,
            d: 'M 0 0 L ' + (vert ? '0 40' : side == 'left' ? '40 0' : '-40 0')
        };
        const circle_args = {
            ref: '.body',
            magnet: port.dir == 'out' ? true : 'passive',
            port: port
        };
        circle_args[vert ? 'ref-x' : 'ref-y'] = loc;
        if (side == 'left') {
            circle_args['ref-x'] = -20;
        } else if (side == 'right') {
            circle_args['ref-dx'] = 20;
        } else if (side == 'top') {
            circle_args['ref-y'] = -20;
        } else console.assert(false);
        _.set(args, ['attrs', 'path.wire.port_' + port.id], wire_args);
        _.set(args, ['attrs', 'circle.port_' + port.id], circle_args);
        let markup = '<path class="wire port_' + port.id + '"/><circle class="port_' + port.id + '"/>';
        if (port.bits > 1) {
            markup += '<text class="bits port_' + port.id + '"/>';
            const bits_args = {
                text: port.bits,
                ref: 'circle.port_' + port.id
            };
            if (vert) {
                // TODO
            } else {
                bits_args['ref-y'] = -3;
                bits_args['text-anchor'] = 'middle';
            }
            if (side == 'left') {
                bits_args['ref-dx'] = 6;
            } else if (side == 'right') {
                bits_args['ref-x'] = -6;
            } else if (side == 'top') {
                bits_args['ref-y'] = 6;
            } else console.assert(false);
            _.set(args, ['attrs', 'text.bits.port_' + port.id], bits_args);
        }
        const signame = port.dir == 'in' ? 'inputSignals' : 'outputSignals';
        if (_.get(args, [signame, port.id]) === undefined) {
            _.set(args, [signame, port.id],
                _.times(port.bits, _.constant(0)));
        }
        return '<g>' + markup + '</g>';
    }
});

joint.shapes.digital.GateView = joint.dia.ElementView.extend({
    stopprop: function(evt) {
        evt.stopPropagation();
    },
});

// Connecting wire model
joint.dia.Link.define('digital.Wire', {
    attrs: {
        '.connection': { 'stroke-width': 2 },
        '.marker-vertex': { r: 7 }
    },
    signal: [0],
    bits: 1,

    router: { name: 'orthogonal' },
    connector: { name: 'rounded', args: { radius: 10 }}
}, {
    arrowheadMarkup: [
        '<g class="marker-arrowhead-group marker-arrowhead-group-<%= end %>">',
        '<circle class="marker-arrowhead" end="<%= end %>" r="7"/>',
        '</g>'
    ].join(''),

    vertexMarkup: [
        '<g class="marker-vertex-group" transform="translate(<%= x %>, <%= y %>)">',
        '<circle class="marker-vertex" idx="<%= idx %>" r="10" />',
        '<g class="marker-vertex-remove-group">',
        '<path class="marker-vertex-remove-area" idx="<%= idx %>" d="M16,5.333c-7.732,0-14,4.701-14,10.5c0,1.982,0.741,3.833,2.016,5.414L2,25.667l5.613-1.441c2.339,1.317,5.237,2.107,8.387,2.107c7.732,0,14-4.701,14-10.5C30,10.034,23.732,5.333,16,5.333z" transform="translate(5, -33)"/>',
        '<path class="marker-vertex-remove" idx="<%= idx %>" transform="scale(.8) translate(9.5, -37)" d="M24.778,21.419 19.276,15.917 24.777,10.415 21.949,7.585 16.447,13.087 10.945,7.585 8.117,10.415 13.618,15.917 8.116,21.419 10.946,24.248 16.447,18.746 21.948,24.248z">',
        '<title>Remove vertex.</title>',
        '</path>',
        '</g>',
        '</g>'
    ].join(''),

    initialize: function(args) {
        joint.dia.Link.prototype.initialize.apply(this, arguments);
        this.router('metro', {
            startDirections: ['right'],
            endDirections: ['left'],
            maximumLoops: 4000
        });
        if (this.has('netname')) {
            this.label(0, {
                markup: [
                    {
                        tagName: 'text',
                        selector: 'label'
                    }
                ],
                attrs: {
                    label: {
                        text: this.get('netname'),
                        fill: 'black'
                    }
                },
                position: {
                    distance: 0.5
                }
            });
        }
    }
});

joint.shapes.digital.WireView = joint.dia.LinkView.extend({
    initialize: function() {
        joint.dia.LinkView.prototype.initialize.apply(this, arguments);
        const cl = help.sigClass(this.model.get('signal'));
        this.$el.toggleClass('live', cl == 'live');
        this.$el.toggleClass('low', cl == 'low');
        this.$el.toggleClass('defined', cl == 'defined');
        this.$el.toggleClass('bus', this.model.get('bits') > 1);
        this.listenTo(this.model, 'change:signal', function(wire, signal) {
            const cl = help.sigClass(this.model.get('signal'));
            this.$el.toggleClass('live', cl == 'live');
            this.$el.toggleClass('low', cl == 'low');
            this.$el.toggleClass('defined', cl == 'defined');
        });
        this.listenTo(this.model, 'change:bits', function(wire, bits) {
            this.$el.toggleClass('bus', bits > 1);
        });
        this.prevModels = { source: null, target: null };
    },

    // custom options:
    options: joint.util.defaults({
        doubleLinkTools: true,
    }, joint.dia.LinkView.prototype.options),

    // Quick-and-dirty performance fix
    onEndModelChange: function(endType, endModel, opt) {
        if (typeof endModel == 'object' && endModel != null &&
            endModel == this.prevModels[endType] &&
            Object.keys(endModel.changed).length > 0 &&
            !('position' in endModel.changed)) return;
        joint.dia.LinkView.prototype.onEndModelChange.apply(this, arguments);
        this.prevModels[endType] = endModel;
    }
});

joint.shapes.digital.Gate.define('digital.Box', {
    attrs: {
        'text.iolabel': { fill: 'black', 'y-alignment': 'middle', ref: '.body' },
        'path.decor': { stroke: 'black', fill: 'transparent' }
    }
}, {
    addLabelledWire: function(args, lblmarkup, side, loc, port) {
        console.assert(side == 'left' || side == 'right');
        const ret = this.addWire(args, side, loc, port);
        lblmarkup.push('<text class="iolabel port_' + port.id + '"/>');
        const textattrs = {
            'ref-y': loc, 'x-alignment': side, text: 'label' in port ? port.label : port.id
        };
        const dist = port.clock ? 10 : 5;
        if (side == 'left') textattrs['ref-x'] = dist;
        else if (side == 'right') textattrs['ref-dx'] = -dist;
        if (port.polarity === false) textattrs['text-decoration'] = 'overline';
        if (port.clock) {
            console.assert(side == 'left');
            let vpath = [
                [0, -6],
                [6, 0],
                [0, 6]
            ];
            const path = 'M' + vpath.map(l => l.join(' ')).join(' L');
            lblmarkup.push('<path class="decor port_' + port.id + '" d="' + path + '" />');
            _.set(args, ['attrs', 'path.decor.port_' + port.id], {
                ref: '.body', 'ref-x': 0, 'ref-y': loc
            });
        }
        _.set(args, ['attrs', 'text.iolabel.port_' + port.id], textattrs);
        return ret;
    }
});

joint.shapes.digital.BoxView = joint.shapes.digital.GateView.extend({
});


