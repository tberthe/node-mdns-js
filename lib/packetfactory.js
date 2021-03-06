var debug = require('debug')('mdns:packetfactory');
var os = require('os');
var dns = require('mdns-js-packet');
var DNSPacket = dns.DNSPacket;
var DNSRecord = dns.DNSRecord;


module.exports.buildQDPacket = function () {
  var packet = new DNSPacket();
  if (typeof this.nameSuffix !== 'string') {
    throw new Error('nameSuffix is missing');
  }
  var name = this.options.name + this.nameSuffix;
  var domain = this.options.domain || 'local';
  var serviceType = this.serviceType.toString() + '.' + domain;
  this.alias = name + '.' + serviceType;

  packet.question.push(new DNSRecord(this.alias, DNSRecord.Type.ANY, 1));
  return packet;
};


module.exports.buildANPacket = function (ttl) {
  if (typeof this.nameSuffix !== 'string') {
    throw new Error('nameSuffix is missing');
  }
  if (typeof this.port !== 'number' && this.port < 1) {
    throw new Error('port is missing or bad value');
  }
  var packet =
    new DNSPacket(DNSPacket.Flag.RESPONSE | DNSPacket.Flag.AUTHORATIVE);
  var domain = this.options.domain || 'local';
  var target = (this.options.host || os.hostname().split('.').shift()) +
               '.' + domain;
  var serviceType = this.serviceType.toString() + '.' + domain;
  var cl = DNSRecord.Class.IN | DNSRecord.Class.FLUSH;

  debug('alias:', this.alias);

  if ('txtRecord' in this.options) {
    packet.answer.push({name: this.alias,
      type: DNSRecord.Type.TXT,
      class: cl,
      ttl: ttl,
      data: this.options.txtRecord
    });
  }
  else if ('txt' in this.options) {
    packet.answer.push({name: this.alias,
      type: DNSRecord.Type.TXT,
      class: cl,
      ttl: ttl,
      data: this.options.txt
    });
  }

  packet.answer.push({name: serviceType,
    type: DNSRecord.Type.PTR,
    class: DNSRecord.Class.IN,
    ttl: ttl,
    data: this.alias});

  packet.answer.push({
    name: this.alias,
    type: DNSRecord.Type.SRV,
    class: cl,
    ttl: ttl,
    priority: 0,
    weight: 0,
    port: this.port,
    target: target
  });

  var interfaces = os.networkInterfaces();
  var ifaceFilter = this.options.networkInterface;
  var addresses = [];
  for (var key in interfaces) {
    if (typeof ifaceFilter === 'undefined' || key === ifaceFilter) {
      for (var i = 0; i < interfaces[key].length; i++) {
        var iface = interfaces[key][i];
        if (!iface.internal) {
          if (iface.family === 'IPv4') {
            addresses.push(iface.address);
          }
        } else {
          // TODO: also publish the ip6_address in an AAAA record
        }
      }
    }
  }

  packet.answer.push({name: target,
    type: DNSRecord.Type.A,
    class: cl,
    ttl: ttl,
    address:addresses[0]});

  return packet;
};
