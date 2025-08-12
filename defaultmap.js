export class DefaultMap extends Map {
    constructor(defaultValue) {
        super();
        this.defaultValue = defaultValue;
    }

    get(key) {
        if (!super.has(key)) { super.set(key, this.defaultValue(key)); }
        return super.get(key);
    }
}