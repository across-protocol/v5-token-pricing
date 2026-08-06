/** Narrow an unknown JSON body to an object without pulling in a validator. */
export function asRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value)
        ? value
        : undefined;
}
//# sourceMappingURL=json.js.map