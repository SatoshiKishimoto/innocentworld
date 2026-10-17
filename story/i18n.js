/* =========================================================
   レンガ村の物語：画面の文言（3種類の表示モード）
     ja   … 日本語（漢字あり・おとな向け）
     kana … にほんご（ひらがな・こども向け。漢字を使わない）
     en   … English（外国からのお客さま向け）
   物語の本文・施設名・アイテムなどはスプレッドシートで管理し、ここには画面の決まった文言だけを置きます。
   ========================================================= */
window.STORY_I18N = {
  langs: {
    ja:   {label: '日本語', sub: '漢字あり（おとな向け）', html: 'ja'},
    kana: {label: 'にほんご', sub: 'ひらがな（こども むけ）', html: 'ja'},
    en:   {label: 'English', sub: 'For international visitors', html: 'en'}
  },
  ui: {
    langBtn:      {ja: 'ことば / Language', kana: 'ことば / Language', en: 'ことば / Language'},
    langTitle:    {ja: '表示することばを選んでください', kana: 'よむ ことばを えらんでね', en: 'Choose your language'},
    langNote:     {ja: 'あとから右上の「🌐 ことば / Language」でいつでも変えられます。', kana: 'あとから みぎうえの「🌐 ことば / Language」で いつでも かえられるよ。', en: 'You can change it anytime with “🌐 ことば / Language” at the top right.'},
    appTitle:     {ja: 'レンガ村の物語', kana: 'レンガむらの ものがたり', en: 'Tales of Brick Village'},
    mapTitle:     {ja: 'レンガ村の地図', kana: 'レンガむらの ちず', en: 'Brick Village Map'},
    back:         {ja: 'もどる', kana: 'もどる', en: 'Back'},
    card:         {ja: '住民票', kana: 'じゅうみんひょう', en: 'Resident Card'},
    soundOn:      {ja: '効果音 オン', kana: 'おと オン', en: 'Sound on'},
    soundOff:     {ja: '効果音 オフ', kana: 'おと オフ', en: 'Sound off'},
    loading:      {ja: '通信しています…', kana: 'つうしんちゅう…', en: 'Connecting…'},
    close:        {ja: 'とじる', kana: 'とじる', en: 'Close'},
    tapClose:     {ja: 'タップでとじる', kana: 'タップで とじる', en: 'Tap to close'},
    // はじまり
    preparing:    {ja: '準備中です', kana: 'じゅんびちゅう です', en: 'Coming soon'},
    welcomeLead:  {ja: '絵本の中の小さな村へようこそ。<br>住民登録をして、あなただけの住民票をつくりましょう。', kana: 'えほんの なかの ちいさな むらへ ようこそ。<br>じゅうみん とうろくを して、あなただけの じゅうみんひょうを つくろう。', en: 'Welcome to a little village inside a picture book.<br>Register as a resident to get your very own Resident Card.'},
    register:     {ja: '住民登録をする', kana: 'じゅうみん とうろくを する', en: 'Register as a resident'},
    restoreBtn:   {ja: '住民票を復元する（機種変更・2回目以降）', kana: 'じゅうみんひょうを もどす（スマホを かえたとき）', en: 'Restore my Resident Card (new phone / returning)'},
    noPersonal:   {ja: '名前やメールアドレスなどの個人情報は必要ありません。ニックネームで参加できます。', kana: 'ほんとうの なまえや メールアドレスは いらないよ。ニックネームで さんか できるよ。', en: 'No personal information is needed. Just choose a nickname.'},
    authLost:     {ja: '住民票が見つかりませんでした。復元コードで戻すか、新しく登録してください。', kana: 'じゅうみんひょうが みつからなかったよ。ふくげんコードで もどすか、あたらしく とうろくしてね。', en: 'We could not find your Resident Card. Restore it with your recovery code, or register again.'},
    offlineMap:   {ja: '通信できないため、保存してある地図を表示しています。', kana: 'つうしん できないので、ほぞんしてある ちずを だしているよ。', en: 'You are offline, so we are showing your saved map.'},
    errTitle:     {ja: 'うまくつながりませんでした', kana: 'うまく つながらなかったよ', en: 'Could not connect'},
    retry:        {ja: 'もう一度ためす', kana: 'もういちど ためす', en: 'Try again'},
    // 住民登録
    regTitle:     {ja: '住民登録', kana: 'じゅうみん とうろく', en: 'Registration'},
    regHead:      {ja: 'レンガ村の住民になる', kana: 'レンガむらの じゅうみんに なろう', en: 'Become a Brick Village resident'},
    optional:     {ja: '（なくてもOK）', kana: '（なくても いいよ）', en: ' (optional)'},
    regSubmit:    {ja: '住民登録する', kana: 'とうろく する', en: 'Register'},
    regNote:      {ja: 'ニックネームには本名を入れないでください。<br>記録は innocent world の運営と、物語の集計だけに使います。', kana: 'ニックネームには ほんとうの なまえを いれないでね。<br>きろくは innocent world の うんえいと、ものがたりの しゅうけいだけに つかうよ。', en: 'Please do not use your real name.<br>Records are used only to run innocent world and to count story results.'},
    fillIn:       {ja: '{0}を入れてください', kana: '{0}を いれてね', en: 'Please enter: {0}'},
    // 復元
    restoreTitle: {ja: '住民票の復元', kana: 'じゅうみんひょうを もどす', en: 'Restore'},
    restoreHead:  {ja: '住民票を復元する', kana: 'じゅうみんひょうを もどす', en: 'Restore your Resident Card'},
    restoreLead:  {ja: '住民票に書かれた「復元コード」（12文字）を入力してください。<br>もちものや物語の続きも戻ります。', kana: 'じゅうみんひょうに かいてある「ふくげんコード」（12もじ）を いれてね。<br>もちものや ものがたりの つづきも もどるよ。', en: 'Enter the 12-character recovery code shown on your Resident Card.<br>Your items and story progress will come back too.'},
    restoreCode:  {ja: '復元コード', kana: 'ふくげんコード', en: 'Recovery code'},
    restoreDo:    {ja: '復元する', kana: 'もどす', en: 'Restore'},
    restoreNote:  {ja: '復元すると、前に使っていたスマホでは住民票が使えなくなります。', kana: 'もどすと、まえの スマホでは つかえなく なるよ。', en: 'After restoring, the Resident Card on your old phone will stop working.'},
    restored:     {ja: 'おかえりなさい！ 住民票を復元しました', kana: 'おかえりなさい！ じゅうみんひょうが もどったよ', en: 'Welcome back! Your Resident Card has been restored'},
    // お休み
    closedHead:   {ja: '今日のレンガ村はお休みです', kana: 'きょうの レンガむらは おやすみ だよ', en: 'Brick Village is closed today'},
    closedLead:   {ja: '物語は、開催日にだけひらきます。住民票はいつでも見られます。', kana: 'ものがたりは、イベントの ひだけ ひらくよ。じゅうみんひょうは いつでも みられるよ。', en: 'The story opens only on event days. You can view your Resident Card anytime.'},
    nextDays:     {ja: '次の開催日', kana: 'つぎの イベントの ひ', en: 'Upcoming event days'},
    seeCard:      {ja: '住民票を見る', kana: 'じゅうみんひょうを みる', en: 'View Resident Card'},
    // 入口
    gateHead:     {ja: '村の入口のひみつのことば', kana: 'むらの いりぐちの ひみつの ことば', en: 'Secret word of the village gate'},
    gateLead:     {ja: '入口に掲示された「ひみつのことば」を入力してください。<br>今日のレンガ村の地図と物語がひらきます。', kana: 'いりぐちの かんばんに かいてある「ひみつの ことば」を いれてね。<br>きょうの ちずと ものがたりが ひらくよ。', en: 'Enter the secret word posted at the entrance.<br>Today’s village map and story will open.'},
    secretWord:   {ja: 'ひみつのことば', kana: 'ひみつの ことば', en: 'Secret word'},
    enter:        {ja: '村に入る', kana: 'むらに はいる', en: 'Enter the village'},
    entered:      {ja: 'ようこそ！ 今日の村の地図がひらきました', kana: 'ようこそ！ きょうの ちずが ひらいたよ', en: 'Welcome! Today’s village map is open'},
    // 地図
    legendLocked: {ja: 'ことばが必要', kana: 'ことばが ひつよう', en: 'Secret word needed'},
    legendOpen:   {ja: '読める', kana: 'よめる', en: 'Ready to read'},
    legendDone:   {ja: '読み終えた', kana: 'よみおわった', en: 'Finished'},
    items:        {ja: 'もちもの', kana: 'もちもの', en: 'Your items'},
    noItems:      {ja: 'まだ何も持っていません。', kana: 'まだ なにも もっていないよ。', en: 'You have no items yet.'},
    mapNote:      {ja: '建物をタップして、施設に掲示されたひみつのことばを入力すると、その施設の物語がひらきます。<br>一度ひらいた施設は、今日のあいだはそのまま読めます。', kana: 'たてものを タップして、かんばんの ひみつの ことばを いれると、ものがたりが ひらくよ。<br>いちど ひらいたら、きょうは そのまま よめるよ。', en: 'Tap a building and enter the secret word posted there to open its story.<br>Once opened, you can read it again freely today.'},
    hiddenPlace:  {ja: 'まだひらいていない場所', kana: 'まだ ひらいていない ばしょ', en: 'A place not yet open'},
    hiddenHint:   {ja: 'まだ道がひらいていません。ほかの施設の物語を読んでみてね。', kana: 'まだ みちが ひらいていないよ。ほかの ものがたりを よんでみてね。', en: 'This path is not open yet. Try reading other stories first.'},
    // 施設
    facLead:      {ja: '施設に掲示されたひみつのことばを入力してください。', kana: 'かんばんに かいてある ひみつの ことばを いれてね。', en: 'Enter the secret word posted at this place.'},
    open:         {ja: 'ひらく', kana: 'ひらく', en: 'Open'},
    facOpened:    {ja: '{0}の物語がひらきました', kana: '{0}の ものがたりが ひらいたよ', en: 'The story of {0} is now open'},
    noStory:      {ja: '今はまだ、ここの物語はありません。', kana: 'いまは まだ、ここの ものがたりは ないよ。', en: 'There is no story here yet.'},
    // 場面
    toMap:        {ja: '地図へ', kana: 'ちずへ', en: 'Map'},
    next:         {ja: 'つぎへ', kana: 'つぎへ', en: 'Next'},
    prev:         {ja: 'もどる', kana: 'もどる', en: 'Back'},
    whatDo:       {ja: 'どうする？', kana: 'どうする？', en: 'What will you do?'},
    gotItem:      {ja: 'をもらった！', kana: 'を もらった！', en: 'Received!'},
    arDefault:    {ja: 'ARを見る', kana: 'ARを みる', en: 'Watch the AR'},
    arNote:       {ja: '新しい画面でARが開きます。見終わったら、この画面にもどってきてね。', kana: 'あたらしい がめんで ARが ひらくよ。みおわったら、ここに もどってきてね。', en: 'The AR opens in a new screen. Come back here when you are done.'},
    backToMap:    {ja: '地図にもどる', kana: 'ちずに もどる', en: 'Back to the map'},
    theEnd:       {ja: 'おしまい', kana: 'おしまい', en: 'The End'},
    sceneMissing: {ja: '物語の続きが見つかりませんでした。', kana: 'ものがたりの つづきが みつからなかったよ。', en: 'The next part of the story was not found.'},
    // 住民票
    village:      {ja: 'レンガ村', kana: 'レンガむら', en: 'Brick Village'},
    residentNo:   {ja: '住民番号', kana: 'じゅうみん ばんごう', en: 'Resident No.'},
    residentName: {ja: '住民名', kana: 'なまえ', en: 'Name'},
    registered:   {ja: '登録日', kana: 'とうろくした ひ', en: 'Registered'},
    friendOf:     {ja: '{0}となかよし', kana: '{0}と なかよし', en: 'Friends with {0}'},
    visited:      {ja: '来村', kana: 'きたよ', en: 'Visited'},
    notYet:       {ja: 'まだ', kana: 'まだ', en: 'Not yet'},
    beforeVisit:  {ja: '来村前', kana: 'これから', en: 'Soon'},
    seal:         {ja: 'レンガ村<br>村長之印', kana: 'レンガむら<br>そんちょう', en: 'Brick<br>Village'},
    codeLabel:    {ja: '復元コード（機種変更のときに使います）<br>このページのスクリーンショットを残してください', kana: 'ふくげんコード（スマホを かえるときに つかうよ）<br>この がめんを スクリーンショットで のこしてね', en: 'Recovery code (use it when you change phones)<br>Please take a screenshot of this page'},
    newCode:      {ja: '復元コードを表示する（新しく発行）', kana: 'ふくげんコードを だす（あたらしく つくる）', en: 'Show recovery code (issue a new one)'},
    newCodeDone:  {ja: '新しい復元コードを発行しました。前のコードは使えなくなりました。', kana: 'あたらしい ふくげんコードを つくったよ。まえの コードは つかえなく なったよ。', en: 'A new recovery code was issued. The old code no longer works.'},
    regDone:      {ja: 'ようこそ、レンガ村へ！ 住民登録が完了しました。', kana: 'ようこそ、レンガむらへ！ とうろくが おわったよ。', en: 'Welcome to Brick Village! Your registration is complete.'},
    goVillage:    {ja: '村へ行く', kana: 'むらへ いく', en: 'Go to the village'},
    deleteBtn:    {ja: '住民票を削除する', kana: 'じゅうみんひょうを けす', en: 'Delete my Resident Card'},
    deleteAsk:    {ja: '住民票と、これまでの記録をすべて削除します。元には戻せません。よろしいですか？', kana: 'じゅうみんひょうと きろくを ぜんぶ けすよ。もとには もどせないよ。いいかな？', en: 'This deletes your Resident Card and all records. This cannot be undone. Continue?'},
    deleted:      {ja: '住民票を削除しました。', kana: 'じゅうみんひょうを けしたよ。', en: 'Your Resident Card was deleted.'},
    // 全画面
    embedLead:    {ja: '全画面で開くと、もっと見やすくなります', kana: 'おおきな がめんで ひらくと みやすいよ', en: 'Open full screen for a better view'},
    embedOpen:    {ja: '全画面で開く', kana: 'おおきく ひらく', en: 'Full screen'},
    you:          {ja: 'あなた', kana: 'あなた', en: 'you'}
  },
  errors: {
    wrong:          {ja: 'ことばがちがうみたい。掲示をもう一度見てみてね。', kana: 'ことばが ちがうみたい。かんばんを もういちど みてね。', en: 'That word doesn’t seem right. Please check the sign again.'},
    wait:           {ja: 'まちがいが続いたので、5分ほど待ってからもう一度入力してください。', kana: 'まちがいが つづいたので、5ふんぐらい まってから もういちど いれてね。', en: 'Too many tries. Please wait about 5 minutes and try again.'},
    closed:         {ja: '今日はレンガ村はお休みです。', kana: 'きょうは レンガむらは おやすみ だよ。', en: 'Brick Village is closed today.'},
    no_word:        {ja: '今日は、ここの物語はお休みです。', kana: 'きょうは、ここの ものがたりは おやすみ だよ。', en: 'This story is closed today.'},
    entrance_first: {ja: '先に、入口のひみつのことばを入力してください。', kana: 'さきに、いりぐちの ひみつの ことばを いれてね。', en: 'Please enter the entrance secret word first.'},
    hidden:         {ja: 'まだ道がひらいていません。', kana: 'まだ みちが ひらいていないよ。', en: 'This path is not open yet.'},
    auth:           {ja: '住民票が確認できませんでした。', kana: 'じゅうみんひょうが たしかめられなかったよ。', en: 'We could not verify your Resident Card.'},
    busy:           {ja: '混み合っています。少し待ってからもう一度お試しください。', kana: 'こんでいるよ。すこし まってから もういちど ためしてね。', en: 'It is busy right now. Please wait a moment and try again.'},
    not_found:      {ja: 'その復元コードは見つかりませんでした。', kana: 'その ふくげんコードは みつからなかったよ。', en: 'That recovery code was not found.'},
    bad_code:       {ja: '復元コードは12文字です（ハイフンはなくても大丈夫）。', kana: 'ふくげんコードは 12もじ だよ（「-」は なくても だいじょうぶ）。', en: 'The recovery code has 12 characters (hyphens are optional).'},
    required:       {ja: '必須の項目を入力してください。', kana: 'ひつような ところを いれてね。', en: 'Please fill in the required fields.'},
    server:         {ja: 'サーバーでエラーが起きました。少し待ってからもう一度お試しください。', kana: 'エラーが おきたよ。すこし まってから もういちど ためしてね。', en: 'A server error occurred. Please wait a moment and try again.'},
    network:        {ja: '通信できませんでした。電波のよい場所で、もう一度お試しください。', kana: 'つうしん できなかったよ。でんぱの よい ところで もういちど ためしてね。', en: 'Could not connect. Please try again where the signal is better.'},
    noapi:          {ja: 'サーバーの設定がまだです（story/config.js）。', kana: 'まだ じゅんび ちゅう だよ。', en: 'The server is not set up yet (story/config.js).'}
  },
  week: {ja: '日月火水木金土', kana: ['にち', 'げつ', 'か', 'すい', 'もく', 'きん', 'ど'], en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']},
  months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
};
