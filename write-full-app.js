const fs = require('fs');
const code = `import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase } from './lib/supabase';

const Stack = createNativeStackNavigator();
const SERVER = 'http://localhost:3001';

function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  async function signIn() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) Alert.alert('Error', error.message);
    setLoading(false);
  }
  return (
    <View style={s.container}>
      <Text style={s.logo}>bridge</Text>
      <Text style={s.sub}>Chat without barriers</Text>
      <TextInput style={s.input} placeholder='Email' value={email} onChangeText={setEmail} autoCapitalize='none' keyboardType='email-address' />
      <TextInput style={s.input} placeholder='Password' value={password} onChangeText={setPassword} secureTextEntry />
      <TouchableOpacity style={s.btn} onPress={signIn} disabled={loading}>
        <Text style={s.btnText}>{loading ? 'Signing in...' : 'Sign in'}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
        <Text style={s.link}>No account? Sign up</Text>
      </TouchableOpacity>
    </View>
  );
}

function SignupScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  async function signUp() {
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) Alert.alert('Error', error.message);
    else Alert.alert('Done', 'Account created');
    setLoading(false);
  }
  return (
    <View style={s.container}>
      <Text style={s.logo}>bridge</Text>
      <Text style={s.sub}>Create account</Text>
      <TextInput style={s.input} placeholder='Email' value={email} onChangeText={setEmail} autoCapitalize='none' keyboardType='email-address' />
      <TextInput style={s.input} placeholder='Password' value={password} onChangeText={setPassword} secureTextEntry />
      <TouchableOpacity style={s.btn} onPress={signUp} disabled={loading}>
        <Text style={s.btnText}>{loading ? 'Creating...' : 'Sign up'}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('Login')}>
        <Text style={s.link}>Already have an account? Sign in</Text>
      </TouchableOpacity>
    </View>
  );
}

function HomeScreen({ navigation, route }) {
  const { user } = route.params;
  const [conversations, setConversations] = useState([]);
  const [newUsername, setNewUsername] = useState('');
  useEffect(() => { loadConversations(); }, []);
  async function loadConversations() {
    const { data } = await supabase
      .from('conversation_members')
      .select('conversation_id, conversations(id, created_at)')
      .eq('user_id', user.id);
    if (data) setConversations(data);
  }
  async function startChat() {
    if (!newUsername.trim()) return;
    const { data: profile } = await supabase
      .from('profiles').select('id').eq('username', newUsername.trim()).single();
    if (!profile) { Alert.alert('Error', 'User not found'); return; }
    const { data: convo } = await supabase
      .from('conversations').insert({ is_group: false }).select().single();
    if (!convo) { Alert.alert('Error', 'Could not create conversation'); return; }
    await supabase.from('conversation_members').insert([
      { conversation_id: convo.id, user_id: user.id },
      { conversation_id: convo.id, user_id: profile.id },
    ]);
    setNewUsername('');
    loadConversations();
    navigation.navigate('Chat', { conversationId: convo.id, userId: user.id });
  }
  async function signOut() { await supabase.auth.signOut(); }
  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.logo}>bridge</Text>
        <TouchableOpacity onPress={signOut}>
          <Text style={s.link}>Sign out</Text>
        </TouchableOpacity>
      </View>
      <Text style={s.sub}>Welcome, {user.email}</Text>
      <View style={s.row}>
        <TextInput style={[s.input, {flex:1, marginBottom:0}]} placeholder='Username to chat with' value={newUsername} onChangeText={setNewUsername} autoCapitalize='none' />
        <TouchableOpacity style={[s.btn, {marginTop:0, marginLeft:8, paddingHorizontal:16}]} onPress={startChat}>
          <Text style={s.btnText}>Chat</Text>
        </TouchableOpacity>
      </View>
      <Text style={[s.sub, {marginTop:24, marginBottom:8, textAlign:'left', fontSize:14}]}>Recent conversations</Text>
      {conversations.length === 0 && <Text style={{color:'#aaa', fontSize:14}}>No conversations yet.</Text>}
      {conversations.map((c) => (
        <TouchableOpacity key={c.conversation_id} style={s.convRow}
          onPress={() => navigation.navigate('Chat', { conversationId: c.conversation_id, userId: user.id })}>
          <Text style={s.convText}>Conversation {c.conversation_id.slice(0,8)}...</Text>
          <Text style={s.convArrow}>→</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function ChatScreen({ route }) {
  const { conversationId, userId } = route.params;
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [translations, setTranslations] = useState({});
  const [translating, setTranslating] = useState({});
  const listRef = useRef(null);
  useEffect(() => {
    loadMessages();
    const channel = supabase
      .channel('messages:' + conversationId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'conversation_id=eq.' + conversationId },
        (payload) => setMessages(prev => [...prev, payload.new]))
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);
  async function loadMessages() {
    const { data } = await supabase.from('messages').select('*')
      .eq('conversation_id', conversationId).order('created_at', { ascending: true });
    if (data) setMessages(data);
  }
  async function sendMessage() {
    if (!text.trim() || sending) return;
    setSending(true);
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: userId,
      original_text: text.trim(),
      original_language: 'en',
    });
    setText('');
    setSending(false);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }
  async function translate(msg, toLang) {
    setTranslating(prev => ({ ...prev, [msg.id]: true }));
    try {
      const res = await fetch(SERVER + '/messages/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_id: msg.id, text: msg.original_text, from_language: msg.original_language || 'en', to_language: toLang })
      });
      const data = await res.json();
      setTranslations(prev => ({ ...prev, [msg.id + toLang]: data.translated }));
    } catch(e) { Alert.alert('Error', 'Translation failed'); }
    setTranslating(prev => ({ ...prev, [msg.id]: false }));
  }
  return (
    <KeyboardAvoidingView style={s.chatContainer} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList ref={listRef} data={messages} keyExtractor={m => m.id}
        contentContainerStyle={{ padding: 16 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => (
          <View style={[s.bubble, item.sender_id === userId ? s.mine : s.theirs]}>
            <Text style={item.sender_id === userId ? s.mineText : s.theirsText}>{item.original_text}</Text>
            {translations[item.id + 'es'] && <Text style={s.transText}>ES: {translations[item.id + 'es']}</Text>}
            {translations[item.id + 'ja'] && <Text style={s.transText}>JA: {translations[item.id + 'ja']}</Text>}
            {translations[item.id + 'fr'] && <Text style={s.transText}>FR: {translations[item.id + 'fr']}</Text>}
            <View style={s.msgFooter}>
              <Text style={s.time}>{new Date(item.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</Text>
              <View style={s.langBtns}>
                <TouchableOpacity onPress={() => translate(item,'es')} style={s.langBtn}>
                <TouchableOpacity onPress={() => translate(item,'es')} style={s.langBtn}>
                  <Text style={s.langBtnText}>ES</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => translate(item,'ja')} style={s.langBtn}>
                  <Text style={s.langBtnText}>JA</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => translate(item,'fr')} style={s.langBtn}>
                  <Text style={s.langBtnText}>FR</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => translate(item,'pt')} style={s.langBtn}>
                  <Text style={s.langBtnText}>PT</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => translate(item,'zh')} style={s.langBtn}>
                  <Text style={s.langBtnText}>ZH</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => translate(item,'ar')} style={s.langBtn}>
                  <Text style={s.langBtnText}>AR</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => translate(item,'de')} style={s.langBtn}>
                  <Text style={s.langBtnText}>DE</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => translate(item,'hi')} style={s.langBtn}>
                  <Text style={s.langBtnText}>HI</Text>
                </TouchableOpacity>
            </View>
          </View>
        )} />
      <View style={s.inputRow}>
        <TextInput style={[s.input, {flex:1, marginBottom:0}]} value={text} onChangeText={setText}
          placeholder='Type a message...' onSubmitEditing={sendMessage} />
        <TouchableOpacity style={[s.btn, {marginTop:0, marginLeft:8, paddingHorizontal:16}]} onPress={sendMessage} disabled={sending}>
          <Text style={s.btnText}>{sending ? '...' : 'Send'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    supabase.auth.onAuthStateChange((_event, session) => setSession(session));
  }, []);
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: true, headerTintColor: '#1D9E75' }}>
        {session ? (
          <>
            <Stack.Screen name='Home' component={HomeScreen} initialParams={{ user: session.user }} options={{ title: 'bridge.' }} />
            <Stack.Screen name='Chat' component={ChatScreen} options={{ title: 'Chat' }} />
          </>
        ) : (
          <>
            <Stack.Screen name='Login' component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name='Signup' component={SignupScreen} options={{ headerShown: false }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff' },
  chatContainer: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  logo: { fontSize: 32, fontWeight: '700', color: '#111' },
  sub: { fontSize: 15, color: '#888', textAlign: 'center', marginBottom: 24 },
  input: { borderWidth: 0.5, borderColor: '#ddd', borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 12, backgroundColor: '#fafafa' },
  btn: { backgroundColor: '#1D9E75', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  link: { textAlign: 'center', marginTop: 8, color: '#1D9E75', fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center' },
  convRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 0.5, borderColor: '#eee', marginBottom: 8, backgroundColor: '#fafafa' },
  convText: { fontSize: 14, color: '#333' },
  convArrow: { fontSize: 16, color: '#1D9E75' },
  bubble: { maxWidth: '75%', marginBottom: 8, padding: 12, borderRadius: 16 },
  mine: { alignSelf: 'flex-end', backgroundColor: '#1D9E75', borderBottomRightRadius: 4 },
  theirs: { alignSelf: 'flex-start', backgroundColor: '#fff', borderBottomLeftRadius: 4, borderWidth: 0.5, borderColor: '#eee' },
  mineText: { color: '#fff', fontSize: 15 },
  theirsText: { color: '#111', fontSize: 15 },
  transText: { fontSize: 12, fontStyle: 'italic', color: 'rgba(255,255,255,0.85)', marginTop: 4, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.3)', paddingTop: 4 },
  msgFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  time: { fontSize: 10, color: 'rgba(255,255,255,0.6)' },
  langBtns: { flexDirection: 'row', gap: 4 },
  langBtn: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  langBtnText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  inputRow: { flexDirection: 'row', padding: 12, backgroundColor: '#fff', borderTopWidth: 0.5, borderTopColor: '#eee', alignItems: 'center' },
});
`;
fs.writeFileSync('App.js', code);
console.log('Done! Bytes:', code.length);
