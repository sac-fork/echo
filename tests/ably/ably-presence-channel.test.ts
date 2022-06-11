import { setup, tearDown } from './setup/sandbox';
import Echo from '../../src/echo';
import { MockAuthServer } from './setup/mock-auth-server';
import { AblyPresenceChannel } from '../../src/channel';
import safeAssert from './setup/utils';

jest.setTimeout(20000);
describe('AblyPresenceChannel', () => {
    let testApp: any;
    let mockAuthServer: MockAuthServer;
    let echo: Echo;

    beforeAll(done => {
        setup((err, app) => {
            if (err) {
                done(err);
                return;
            }
            testApp = app;
            mockAuthServer = new MockAuthServer(testApp.keys[0].keyStr);
            done();
        })
    })

    afterAll((done) => {
        tearDown(testApp, (err) => {
            if (err) {
                done(err);
                return;
            }
            done();
        })
    })

    beforeEach(() => {
        echo = new Echo({
            broadcaster: 'ably',
            useTls: true,
            environment: 'sandbox',
            requestTokenFn: mockAuthServer.getSignedToken
        });
    });

    afterEach(done => {
        echo.disconnect();
        echo.connector.ably.connection.once('closed', () => {
            done();
        });
    });

    test('channel subscription', (done) => {
        const presenceChannel = echo.join('test') as AblyPresenceChannel;
        presenceChannel.subscribed(() => {
            presenceChannel.unregisterSubscribed();
            done();
        });
    });

    test('channel member list change', done => {
        const presenceChannel = echo.join('test') as AblyPresenceChannel;
        presenceChannel.here((members, err) => {
            safeAssert(() => {
                expect(members).toHaveLength(1);
                expect(members[0].clientId).toBe('sacOO7@github.com');
                expect(members[0].data).toStrictEqual({ id: 'sacOO7@github.com', name: 'sacOO7' });
            }, done, true);
        });
    });

    test('member joined', done => {
        const presenceChannel = echo.join('test') as AblyPresenceChannel;
        presenceChannel.joining(member => {
            safeAssert(() => {
                expect(member.clientId).toBe('sacOO7@github.com');
                expect(member.data).toStrictEqual({ id: 'sacOO7@github.com', name: 'sacOO7' });
            }, done, true);
        })
    })

    test.skip('member left', done => {
        const presenceChannel = echo.join('test') as AblyPresenceChannel;
        presenceChannel.leaving((member) => {
            safeAssert(() => {
                expect(member.clientId).toBe('sacOO7@github.com');
                expect(member.data).toStrictEqual({ name: 'sacOO7 leaving the channel' });
            }, done, true);
        })
        presenceChannel.leave({name: 'sacOO7 leaving the channel'});
    })
});