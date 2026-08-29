'use strict';

/**
 * Version numbers shared by generation and installation receipts.
 *
 * The adapter contract version identifies the receipt/envelope contract. The
 * generator version advances whenever the compiler's projection changes.
 */
module.exports = Object.freeze({
  ADAPTER_CONTRACT_VERSION: 1,
  GENERATOR_VERSION: 4
});
