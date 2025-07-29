export class DefaultMap extends Map {
    constructor(defaultValue) {
        this.defaultValue = defaultValue;
        super();
    }

    get(key) {
        if (!super.has(key)) { super.set(key, this.defaultValue(key)); }
        return super.get(key);
    }
}