// lib/safeRepeat.ts

const originalRepeat = String.prototype.repeat;

String.prototype.repeat = function (count: number): string {
  if (typeof count !== "number" || !Number.isFinite(count) || count < 0) {
    throw new RangeError("Invalid count value for String.prototype.repeat");
  }
  return originalRepeat.call(this, count);
};



