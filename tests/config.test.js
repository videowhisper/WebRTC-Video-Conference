import { it, expect, vi, afterEach } from 'vitest';
afterEach(()=>vi.unstubAllGlobals());
it('uses complete injected configuration without fetching a page-relative JSON file',async()=>{
 vi.resetModules();const fetch=vi.fn();vi.stubGlobal('fetch',fetch);vi.stubGlobal('window',{location:{search:'?room=forged'},videowhisperConfig:{channel:'allowed',username:'user',enableGET:false,videowhisperServer:{socket:'https://example.test/conference',authentication:'pin',account:'a',user:'user',pin:'test-room-pin'}}});
 const {loadConferenceConfig}=await import('../src/config/configLoader');const config=await loadConferenceConfig();expect(config.channel).toBe('allowed');expect(fetch).not.toHaveBeenCalled();
});
it('does not bypass a configured room lock with query parameters',async()=>{
 vi.resetModules();vi.stubGlobal('window',{location:{search:'?room=forged&name=Guest'},videowhisperConfig:{channel:'allowed',username:'user',enableGET:true,configLock:true,videowhisperServer:{socket:'https://example.test/conference'}}});
 const {loadConferenceConfig}=await import('../src/config/configLoader');expect((await loadConferenceConfig()).channel).toBe('allowed');
});
