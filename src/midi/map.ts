// All pedal knowledge lives here (ADR 0002). The parameter table arrives with the first Module.

/** The pedal's factory MIDI channel. */
export const DEFAULT_MIDI_CHANNEL = 1;

/**
 * The pedal's own USB port is "HOLOGRAM Chroma Console MIDI". Matched loosely: operating systems add prefixes and suffixes
 * such as "2- " or " 1".
 */
export const PEDAL_PORT_NAME = /chroma console/i;
