// Character roster. Emoji avatars that react to game events with animation, a
// signature projectile, particle bursts, and a synthesized voice.
//   shot  : emoji fired at the opponent when attacking (signature move)
//   color : particle/aura color
//   voice : { base, type, vib } synth profile (see audio.js voice())
// special: { id (effect key), name (技名), telop (決め台詞), kind: 攻/妨/防 }
window.CHARACTERS = [
  { id:'robot',   name:'ロボ',       emoji:'🤖', shot:'⚡', color:'#9bd1ff', voice:{ base:200, type:'square',   vib:0  },
    special:{ id:'overclock', name:'オーバークロック', telop:'システム全開！', kind:'防' } },
  { id:'alien',   name:'エイリアン', emoji:'👾', shot:'🛸', color:'#b388ff', voice:{ base:520, type:'sawtooth', vib:10 },
    special:{ id:'abduction', name:'アブダクション', telop:'連れ去るぞ！', kind:'妨' } },
  { id:'cat',     name:'ネコ',       emoji:'🐱', shot:'🐾', color:'#ffd1dc', voice:{ base:700, type:'sine',     vib:8  },
    special:{ id:'catrush', name:'ねこパンチ連打', telop:'にゃーパンチ！', kind:'攻' } },
  { id:'fox',     name:'キツネ',     emoji:'🦊', shot:'🍂', color:'#ff9e54', voice:{ base:600, type:'triangle', vib:5  },
    special:{ id:'trick', name:'トリックスター', telop:'化かしてやる！', kind:'妨' } },
  { id:'dragon',  name:'ドラゴン',   emoji:'🐲', shot:'🔥', color:'#ff6b3d', voice:{ base:90,  type:'sawtooth', vib:3  },
    special:{ id:'firebreath', name:'ファイアブレス', telop:'焼き尽くせ！', kind:'攻' } },
  { id:'ghost',   name:'ゴースト',   emoji:'👻', shot:'💀', color:'#d6e0ff', voice:{ base:300, type:'sine',     vib:12 },
    special:{ id:'poltergeist', name:'ポルターガイスト', telop:'ひっくり返れ！', kind:'妨' } },
  { id:'bear',    name:'クマ',       emoji:'🐻', shot:'💢', color:'#c89a6b', voice:{ base:120, type:'sawtooth', vib:2  },
    special:{ id:'maul', name:'剛腕アタック', telop:'くらえッ！', kind:'攻' } },
  { id:'frog',    name:'カエル',     emoji:'🐸', shot:'💧', color:'#9bf6a8', voice:{ base:180, type:'square',   vib:14 },
    special:{ id:'mirror', name:'みずかがみ', telop:'ケロロ反転！', kind:'防' } },
  { id:'penguin', name:'ペンギン',   emoji:'🐧', shot:'❄️', color:'#7ad0ff', voice:{ base:480, type:'triangle', vib:4  },
    special:{ id:'blizzard', name:'ブリザード', telop:'凍りつけ！', kind:'妨' } },
  { id:'unicorn', name:'ユニコーン', emoji:'🦄', shot:'🌈', color:'#ff9ee8', voice:{ base:660, type:'sine',     vib:6  },
    special:{ id:'heal', name:'レインボーヒール', telop:'キラキラ☆回復！', kind:'防' } },
  { id:'ninja',   name:'ニンジャ',   emoji:'🥷', shot:'⭐', color:'#cfd6e6', voice:{ base:340, type:'square',   vib:0  },
    special:{ id:'shuriken', name:'手裏剣乱舞', telop:'忍法・乱舞！', kind:'攻' } },
  { id:'octopus', name:'タコ',       emoji:'🐙', shot:'🖤', color:'#ff7eb0', voice:{ base:260, type:'sine',     vib:9  },
    special:{ id:'ink', name:'スミ攻撃', telop:'目隠しだ！', kind:'妨' } },
];
window.CHAR_BY_ID = {};
for (const c of CHARACTERS) CHAR_BY_ID[c.id] = c;
const _c = id => CHAR_BY_ID[id] || CHARACTERS[0];
window.charEmoji = id => _c(id).emoji;
window.charName  = id => _c(id).name;
window.charShot  = id => _c(id).shot;
window.charColor = id => _c(id).color;
window.charVoice = id => _c(id).voice;
window.charSpecial = id => _c(id).special;
