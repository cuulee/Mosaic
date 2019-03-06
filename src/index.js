import { m, TemplateTable } from "./templating/m";
import { Observable } from './observable';
import { isHTMLElement, findInvalidOptions, getDOMfromID } from './validations';
import { randomKey } from './util';

/** The configuration options for a Mosaic component.
 * @typedef {MosaicOptions} MosaicOptions Configuration options for a Mosaic component.
 * @param {HTMLElement} element The DOM element to inject this component into.
 * @param {Object} data The data of this component.
 * @param {Function | String} view The view to define the appearance of this component.
 * @param {Function} created Called when this component is created.
 * @param {Function} willUpdate Called when this component is about to update.
 * @param {Function} updated Called when this component has been updated.
 * @param {Function} willDestroy Called when this component is about to be destroyed.
*/
const MosaicOptions = {
    /** The HTML element to inject this Mosaic component into. */
    element: HTMLElement,

    /** The state of this component. */
    data: Object,

    /** The view that will be rendered on the screen. */
    view: Function,

    /** The actions that can be used on this Mosaic component. */
    actions: Object,

    /** The function to run when this component is created and injected into the DOM. */
    created: Function,

    /** The function to run when this component is about to update its data. */
    willUpdate: Function,

    /** The function to run after this component has been updated. */
    updated: Function,

    /** The function that runs just before this component gets removed from the DOM. */
    willDestroy: Function
};


/** Creates a new Mosaic component with configuration options.
* @param {MosaicOptions} options The configuration options for this Mosaic. */
const Mosaic = function(options) {
    let invalids = findInvalidOptions(options);
    if(invalids !== undefined) throw new Error(invalids);

    this.tid = options.tid || randomKey();
    this.element = typeof options.element === 'string' ? getDOMfromID(options.element) : options.element;
    this.view = options.view;
    this.created = options.created;
    this.willUpdate = options.willUpdate;
    this.updated = options.updated;
    this.willDestroy = options.willDestroy;

    // Make each array a proxy of its own then etup the data observer.
    let _tempData = makeArraysObservable.call(this, options.data);
    this.data = new Observable(_tempData || {}, (oldData) => {
        if(this.willUpdate) this.willUpdate(oldData);
    }, () => {
        this.repaint();
        if(this.updated) this.updated(this.data, this.actions);
    });

    this.actions = options.actions;
    this.options = Object.assign({}, options);
    this.__isMosaic = true;

    // Create the Template, set the Parts on this Mosaic, and set the element
    // on this Mosaic. Parts will be updated when we create instances with new.
    if(!TemplateTable[this.tid]) {
        let template = this.view(this.data, this.actions);
        this.parts = template.createParts(template.element.content);
        this.values = template.values.slice()[0];
        TemplateTable[this.tid] = template;

        if(!document.contains(this.element)) {
            this.element = template.element.content.cloneNode(true);
        }
    }

    return this;
}

/** "Paints" the Mosaic onto the page by injecting it into its base element. */
Mosaic.prototype.paint = function() {
    if(!this.element || !isHTMLElement(this.element)) {
        throw new Error(`This Mosaic could not be painted because its element property is either not set
        or is not a valid HTML element.`);
    }
    while(this.element.firstChild) this.element.removeChild(this.element.firstChild);

    // Clone the template and repaint it, which basically paints it
    // for the first time.
    let template = TemplateTable[this.tid];
    let cloned = template.element.content;

    let base = this.element;
    this.element = cloned;
    this.repaint();
    
    // Replace the base element with the repainted element.
    base.replaceWith(this.element);

    // Call the created lifecycle function.
    if(this.created) this.created(this.data, this.actions);
}

/** Forces an update (repaint of the DOM) on this component. */
Mosaic.prototype.repaint = function() {
    // Go through each Part and decide what to do with its DOM node.
    for(let i = 0; i < this.parts.length; i++) {
        let part = this.parts[i];

        part.checkWasChanged(this.values[i], i);
        if(part.dirty === false) continue;
        part.commit(this, this.element, this.values[i]);
    }
}

Mosaic.prototype.new = function(newData = {}) {
    // Make a copy of this Mosaic.
    let _options = Object.assign({}, this.options);
    _options.data = Object.assign({}, this.data, newData);
    _options.tid = this.tid;

    let copy = new Mosaic(_options);
    copy.iid = randomKey();
    copy.parts = this.parts.slice();
    copy.element = this.element.cloneNode(true);
    
    // Update the values.
    let newView = copy.view(copy.data, copy.actions);
    copy.values = newView.values.slice()[0];

    // Repaint with the new values.
    copy.repaint();
    return copy;
}

/** Checks if two Mosaics are equal to each other. 
* @param {Mosaic} other Whether or not this Mosaic is equal to another. */
Mosaic.prototype.equals = function(other) {
    return (this.tid === other.tid) && (this.iid === other.iid);
}


/*
* ------------- HELPERS -------------- 
*/

const makeArraysObservable = function(data) {
    let _tempData = data;
    for(var i in _tempData) {
        if(!Array.isArray(_tempData[i])) continue;
        
        _tempData[i] = new Observable(_tempData[i], () => {
            if(this.willUpdate) this.willUpdate(oldData);
        }, () => {
            this.repaint();
            if(this.updated) this.updated();
        });
    }
    return _tempData;
}


window.html = m;
window.Mosaic = Mosaic;
export default Mosaic;