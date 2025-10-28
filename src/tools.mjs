"use strict";

import * as joint from '@joint/core';
import _ from 'lodash';

const circleArrowhead = {
    tagName: 'circle',
    attributes: {
        'r': 7,
        'fill': 'black',
        'fill-opacity': 0.3,
        'stroke': 'black',
        'stroke-width': 2,
        'cursor': 'move'
    }
};
export const CircleSourceArrowhead = joint.linkTools.SourceArrowhead.extend(_.merge({}, circleArrowhead));
export const CircleTargetArrowhead = joint.linkTools.TargetArrowhead.extend(_.merge({}, circleArrowhead));

export const DoublyButton = joint.linkTools.Button.extend({
    update() {
        if (this.relatedView.isShortWire()) {
            this.options.distance = this.options.distanceShort || this.options.distance;
            if (this.options.secondary) this.hide();
        } else {
            this.options.distance = this.options.distanceLong || this.options.distance;
        }
        return joint.linkTools.Button.prototype.update.apply(this, arguments);
    }
});
export const RemoveButton = DoublyButton.extend({
    name: 'remove',
    children: joint.linkTools.Remove.prototype.children,
    options: joint.linkTools.Remove.prototype.options
});
export const MonitorButton = DoublyButton.extend({
    name: 'monitor',
    children: [{
        tagName: 'circle',
        selector: 'button',
        attributes: {
            'r': 7,
            'fill': '#001DFF',
            'cursor': 'pointer'
        }
    }, {
        tagName: 'path',
        selector: 'icon',
        attributes: {
            'd': 'm -2.5,-0.5 a 2,2 0 1 0 4,0 2,2 0 1 0 -4,0 M 1,1 3,3',
            'fill': 'none',
            'stroke': '#FFFFFF',
            'stroke-width': 2,
            'pointer-events': 'none'
        }
    }],
    options: {
        action(evt) {
            this.notify('link:monitor');
        }
    }
});
