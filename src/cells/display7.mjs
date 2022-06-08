import { IO, IOView, NumBase } from './io.mjs';
import { BoxView } from './base.mjs';

const highColor = '#03c03c';
const lowColor = '#3c3c3c';

/*
 * This is a standard 7-segment display element.
 * It is designed to take an 8-bit number as an input.
 *
 * The most significant bit determines the decimal point state (dp).
 * The latter bits determine respectively: a,b,c,d,e,f,g segments of the display.
 * (g is determined by the least significant bit).
 *
 * The placement of single segments of the display can be checked
 * on the wikipedia page here:
 * https://en.wikipedia.org/wiki/Seven-segment_display#/media/File:7_Segment_Display_with_Labeled_Segments.svg
 */
export const Display7 = IO.define('Display7',
{
  bits: 8,
  size: { width: 76.5, height: 110 },
  attrs: {
    LEDs: {
      fill: lowColor,
      transform: 'translate(1,1),scale(6)'
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
    dp: {
      cx: '11.3',
      cy: '16.9',
      r: '1.1'
    },
    body: {
      height: 'calc(h)',
      width: 'calc(w)',
      stroke: '#222222',
      fill: '#333333',
    }
  }
}, {
  isOutput: true,
  _portDirection: 'in',
  bits: 8,

  getOutput() {
    return this.get('inputSignals').in;
  },
  markupBus: NumBase.prototype.markup.concat([
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
    }, {
      tagName: 'circle',
      selector: 'dp',
      groupSelector: 'LEDs'
    }]),
});

export const Display7View = IOView.extend({
  _autoResizeBox: false,

  confirmUpdate(flags) {
    BoxView.prototype.confirmUpdate.apply(this, arguments);
    this._updateDisplay();
  },
  _updateDisplay() {
    const inputSignal = this.model.getOutput();
    const newAttrs = {
      dp: { fill: inputSignal.get(7) === 1 ? highColor : lowColor },
      a: { fill: inputSignal.get(6) === 1 ? highColor : lowColor },
      b: { fill: inputSignal.get(5) === 1 ? highColor : lowColor },
      c: { fill: inputSignal.get(4) === 1 ? highColor : lowColor },
      d: { fill: inputSignal.get(3) === 1 ? highColor : lowColor },
      e: { fill: inputSignal.get(2) === 1 ? highColor : lowColor },
      f: { fill: inputSignal.get(1) === 1 ? highColor : lowColor },
      g: { fill: inputSignal.get(0) === 1 ? highColor : lowColor },
    };
    this._applyAttrs(newAttrs);
  },
});
