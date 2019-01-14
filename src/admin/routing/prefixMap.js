"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = require("lodash");
class PrefixMap {
    constructor() {
        this.prefixes = [];
        this.items = {};
    }
    keys() { return this.prefixes; }
    size() { return this.prefixes.length; }
    resolve(key) {
        const prefix = this.resolvePrefix(key);
        return typeof prefix !== 'undefined' ? this.items[prefix] : undefined;
    }
    resolvePrefix(key) {
        if (this.items[key])
            return key;
        const index = lodash_1.findIndex(this.prefixes, (e) => key.startsWith(e + '.'));
        if (index === -1)
            return undefined;
        const prefix = this.prefixes[index];
        return prefix;
    }
    get(prefix) { return this.items[prefix]; }
    *getKeysStartingWith(prefix) {
        const predicate = (key) => key.startsWith(prefix);
        let index = -1;
        while ((index = lodash_1.findIndex(this.prefixes, predicate, index + 1)) !== -1) {
            yield this.prefixes[index];
        }
    }
    *getKeysPrefixesOf(search) {
        const predicate = (key) => search.startsWith(key + '.');
        let index = -1;
        while ((index = lodash_1.findIndex(this.prefixes, predicate, index + 1)) !== -1) {
            yield this.prefixes[index];
        }
    }
    each(fn) {
        for (const prefix of this.prefixes) {
            fn(this.items[prefix], prefix);
        }
    }
    insert(prefix, item) {
        if (!this.items[prefix]) {
            const index = lodash_1.findIndex(this.prefixes, (e) => {
                if (prefix.length === e.length) {
                    return prefix > e;
                }
                return prefix.length > e.length;
            });
            if (index === -1) {
                this.prefixes.push(prefix);
            }
            else {
                this.prefixes.splice(index, 0, prefix);
            }
        }
        this.items[prefix] = item;
        return item;
    }
    delete(prefix) {
        const index = this.prefixes.indexOf(prefix);
        if (this.prefixes[index] === prefix)
            this.prefixes.splice(index, 1);
        delete this.items[prefix];
    }
    toJSON() {
        return this.items;
    }
    getShortestUnambiguousPrefix(address, prefix = '') {
        if (!address.startsWith(prefix)) {
            throw new Error(`address must start with prefix. address=${address} prefix=${prefix}`);
        }
        this.keys().forEach((secondPrefix) => {
            if (secondPrefix === prefix) {
                return;
            }
            while (secondPrefix.startsWith(prefix)) {
                if (secondPrefix === prefix) {
                    return;
                }
                const nextSegmentEnd = address.indexOf('.', prefix.length + 1);
                if (nextSegmentEnd === -1) {
                    prefix = address;
                    return;
                }
                else {
                    prefix = address.slice(0, nextSegmentEnd);
                }
            }
        });
        return prefix;
    }
}
exports.default = PrefixMap;