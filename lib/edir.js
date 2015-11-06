'use strict';

var _ = require('lodash');
var Ldap = require('lderp');
var util = require('util');

function EdirLdap(host, options) {
    options = options || {};
    Ldap.call(this, host, options);
    this.name = 'edir';
    this.usernameAttribute = options.usernameAttribute || 'cn';
    this.zombieUsername = options.zombieUsername || '';
    this.zombiePassword = options.zombiePassword || '';
}

util.inherits(EdirLdap, Ldap);

EdirLdap.prototype.bindAsZombie = function (zombieUsername, zombiePassword) {
    return Ldap.prototype.bindAsUser.call(this, this.buildDn(zombieUsername || this.zombieUsername), zombiePassword || this.zombiePassword);
};

EdirLdap.prototype.buildDn = function (cn) {
    return 'cn=' + cn + ',' + this.baseDn;
};

EdirLdap.prototype.buildObjectClass = function () {
    return [
        'inetOrgPerson',
        'organizationalPerson',
        'Person',
        'ndsLoginProperties',
        'Top'
    ];
};

EdirLdap.prototype.buildUserEntry = function (options) {
    var entry = _.clone(options);
    entry.objectClass = this.buildObjectClass();
    entry.uid = entry.cn;
    return entry;
};

EdirLdap.prototype.createUser = function (options) {
    return Ldap.prototype.createUser.call(this, this.buildDn(options.cn), options);
};

EdirLdap.prototype.deleteUser = function (cn) {
    return Ldap.prototype.deleteUser.call(this, this.buildDn(cn));
};

EdirLdap.prototype.findAllEmailAddressless = function (startsWith) {
    return Ldap.prototype._search.call(this, '(&(cn=' + startsWith + '*)(!(cn=*@*)))');
};

EdirLdap.prototype.modifyUser = function (cn, options) {
    var self = this;
    var newCn = options.cn || options.username || null;
    var newUserPassword = options.userPassword || options.password || null;
    var newSn = options.sn || options.firstname || null;
    var newGivenName = options.givenName || options.lastname || null;
    var newMail = options.mail || options.email || null;
    return Ldap.prototype.findUser.call(this, cn)
        .then(function (user) {
            if (!user) {
                throw new Error('User could not be located');
            }
            self.user = user;
            if (!!newCn) {
                var newDn = this.buildDn(newCn);
                return self._client.modifyDNAsync(user.dn, newDn)
                    .then(function () {
                        return newDn;
                    })
            }
            else {
                return user.dn;
            }
        })
        .then(function (dn) {
            var changes = [];
            if (!!newCn) {
                changes.push(self.buildLdapChangeObject('replace', { uid: newCn })); // keeping UID and CN in sync
            }
            if (!!newUserPassword) {
                changes.push(self.buildLdapChangeObject('replace', { userPassword: newUserPassword }));
            }
            if (!!newSn) {
                changes.push(self.buildLdapChangeObject('replace', { sn: newSn }));
            }
            if (!!newGivenName) {
                changes.push(self.buildLdapChangeObject('replace', { givenName: newGivenName }));
            }
            if (!!newMail) {
                changes.push(self.buildLdapChangeObject('replace', { mail: newMail }));
            }
            return self._client.modifyAsync(dn, changes);
        })
        .then(function (r) {
            return r;
        })
};

module.exports = EdirLdap;
