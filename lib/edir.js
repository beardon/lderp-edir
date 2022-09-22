const _ = require('lodash');
const Ldap = require('lderp');
const util = require('util');

function EdirLdap(host, options) {
    options = options || {};
    Ldap.call(this, host, options);
    this.name = 'edir';
    this.usernameAttribute = options.usernameAttribute || 'cn';
    this.zombieDn = options.zombieDn || options.baseDn || ''
    this.zombieUsername = options.zombieUsername || '';
    this.zombiePassword = options.zombiePassword || '';
}

util.inherits(EdirLdap, Ldap);

EdirLdap.prototype.bindAsZombie = function (zombieUsername, zombiePassword, zombieDn) {
    return Ldap.prototype.bindAsUser.call(this, this.buildDn((zombieUsername || this.zombieUsername), (zombieDn || this.zombieDn)), zombiePassword || this.zombiePassword);
};

EdirLdap.prototype.buildDn = function (cn, baseDn = this.baseDn) {
    return 'cn=' + cn + ',' + baseDn;
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
    let entry = _.clone(options);
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
    const self = this;
    options = options || {};
    const newCn = options.cn || options.username || null;
    options.uid = options.uid || newCn || null; // keeping UID and CN in sync
    options.givenName = options.givenName || options.firstname || null;
    options.mail = options.mail || options.email || null;
    options.sn = options.sn || options.lastname || null;
    options.userPassword = options.userPassword || options.password || null;
    options = _.omit(options, ['cn', 'username', 'firstname', 'email', 'lastname', 'password']);
    options = _.omitBy(options, _.isNull);
    return Ldap.prototype.findUser.call(this, cn)
        .then(function (user) {
            if (!user) {
                throw new Error('User could not be located');
            }
            self.user = user;
            const changes = _.map(options, function (value, key) {
                return self.buildLdapChangeObject('replace', { [key]: value });
            });
            return self._client.modifyAsync(user.dn, changes);
        })
        .then(function (r) {
            if (!newCn) {
                return r;
            }
            const newDn = self.buildDn(newCn);
            return self._client.modifyDNAsync(self.user.dn, newDn)
                .return(r);
        })

};

module.exports = EdirLdap;
