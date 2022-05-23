import { IO, IOView } from './io.mjs';
import _ from 'lodash';

const highColor = '#03c03c'; 
const Display7HexMapping = {
  r: {
    LEDs: { fill: '#3c3c3c' }
  },
  '0': {
    a: { fill: highColor },
    b: { fill: highColor },
    c: { fill: highColor },
    d: { fill: highColor },
    e: { fill: highColor },
    f: { fill: highColor },
  },
  '1': {
    b: { fill: highColor },
    c: { fill: highColor },
  },
  '2': {
    a: { fill: highColor },
    b: { fill: highColor },
    g: { fill: highColor },
    e: { fill: highColor },
    d: { fill: highColor },
  },
  '3': {
    a: { fill: highColor },
    b: { fill: highColor },
    g: { fill: highColor },
    c: { fill: highColor },
    d: { fill: highColor },
  },
  '4': {
    f: { fill: highColor },
    g: { fill: highColor },
    b: { fill: highColor },
    c: { fill: highColor },    
  },
  '5': {
    a: { fill: highColor },
    f: { fill: highColor },
    g: { fill: highColor },
    c: { fill: highColor },
    d: { fill: highColor },
  },
  '6': {
    a: { fill: highColor },
    f: { fill: highColor },
    g: { fill: highColor },
    c: { fill: highColor },
    d: { fill: highColor },
    e: { fill: highColor },
  },
  '7': {
    a: { fill: highColor },
    b: { fill: highColor },
    c: { fill: highColor },
  },
  '8': {
    a: { fill: highColor },
    f: { fill: highColor },
    g: { fill: highColor },
    c: { fill: highColor },
    d: { fill: highColor },
    e: { fill: highColor },
    b: { fill: highColor },
  },
  '9': {
    a: { fill: highColor },
    f: { fill: highColor },
    g: { fill: highColor },
    c: { fill: highColor },
    d: { fill: highColor },
    b: { fill: highColor },
  },
  a: {
    a: { fill: highColor },
    b: { fill: highColor },
    c: { fill: highColor },
    e: { fill: highColor },
    f: { fill: highColor },
    g: { fill: highColor },
  },
  b: {
    c: { fill: highColor },
    d: { fill: highColor },
    e: { fill: highColor },
    f: { fill: highColor },
    g: { fill: highColor },
  },
  c: {
    a: { fill: highColor },
    d: { fill: highColor },
    e: { fill: highColor },
    f: { fill: highColor },
  },
  d: {
    b: { fill: highColor },
    c: { fill: highColor },
    d: { fill: highColor },
    e: { fill: highColor },
    g: { fill: highColor },
  },
  e: {
    a: { fill: highColor },
    d: { fill: highColor },
    e: { fill: highColor },
    f: { fill: highColor },
    g: { fill: highColor },
  },
  f: {
    a: { fill: highColor },
    e: { fill: highColor },
    f: { fill: highColor },
    g: { fill: highColor },
  },
  err: {
    // a: { fill: highColor },
    // g: { fill: highColor },
    d: { fill: highColor },
  }
};

export const Display7 = IO.define('Display7', {
  size: { height: 108 },

  attrs: {
    LEDs: {
      fill: '#333333',
      transform: 'scale(6 6)'
    },
    a: {
      points: '1, 1  2, 0  8, 0  9, 1  8, 2  2, 2'
    },
    b: {
      points: '9, 1 10, 2 10, 8  9, 9  8, 8  8, 2'
    },
    c: {
      points: '9, 9 10,10 10,16  9,17  8,16  8,10'
    },
    d: {
      points: '9,17  8,18  2,18  1,17  2,16  8,16'
    },
    e: {
      points: '1,17  0,16  0,10  1, 9  2,10  2,16'
    },
    f: {
      points: '1, 9  0, 8  0, 2  1, 1  2, 2  2, 8'
    },
    g: {
      points: '1, 9  2, 8  8, 8  9, 9  8,10  2,10'
    },
    body: {
      height: 'calc(h)',
      stroke: '#222222',
      fill: '#333333',
    }
  }
}, {
  isOutput: true,

  _portDirection: 'in',
  bits: 4,

  getOutput() {
    return this.get('inputSignals').in;
  },
  markupBus: IO.prototype.markupBus.concat([
    {
    tagName: 'rect',
    selector: 'display'
  }, 
  {
    tagName: 'polygon',
    selector: 'a',
    groupSelector: 'LEDs'
  }, {
    tagName: 'polygon',
    selector: 'b',
    groupSelector: 'LEDs'
  }, {
    tagName: 'polygon',
    selector: 'c',
    groupSelector: 'LEDs'
  }, {
    tagName: 'polygon',
    selector: 'd',
    groupSelector: 'LEDs'
  }, {
    tagName: 'polygon',
    selector: 'e',
    groupSelector: 'LEDs'
  }, {
    tagName: 'polygon',
    selector: 'f',
    groupSelector: 'LEDs'
  }, {
    tagName: 'polygon',
    selector: 'g',
    groupSelector: 'LEDs'
  }]),

  numBaseType: 'read',
});

export const Display7View = IOView.extend({
  attrs: _.merge({ LEDs: Display7HexMapping }, IOView.prototype.attrs),

  confirmUpdate(flags) {
    IOView.prototype.confirmUpdate.apply(this, arguments);
    this._updateDisplay();
  },
  _updateDisplay() {
    const numBase = this.model.get('numbase');
    const inputSignal = this.model.getOutput();
    const display3vl = this.model.graph._display3vl;
    const outputNumber = display3vl.show(numBase, inputSignal);

    const newAttrs = Display7HexMapping.hasOwnProperty(outputNumber)
      ? this.attrs.LEDs[outputNumber]
      : this.attrs.LEDs[err];
    this._resetDisplay();
    this._applyAttrs(newAttrs);
  },
  _resetDisplay() {
    this._applyAttrs(Display7HexMapping.r);
  }
});
