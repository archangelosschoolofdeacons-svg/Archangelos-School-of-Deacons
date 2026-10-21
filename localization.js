(function () {
  const pairs = [
    ['مدرسة أرشى أنجيلوس للشمامسة (Archangelos School of Deacons)', 'Archangelos School of Deacons'],
    ['Archangelos School of Deacons (مدرسة أرشى أنجيلوس للشمامسة)', 'Archangelos School of Deacons'],
    ['Archangelos School of Deacons · مدرسة أرشى أنجيلوس للشمامسة', 'Archangelos School of Deacons'],
    ['مرحبًا بكم في مكتبة Archangelos School of Deacons · مدرسة أرشى أنجيلوس للشمامسة', 'Welcome to the Archangelos School of Deacons library'],
    ['مرحبًا بكم في Archangelos School of Deacons (مدرسة أرشى أنجيلوس للشمامسة)؛ مكتبة تعليمية تجمع الألحان واللغة القبطية والطقس الكنسي، في رحلة تناسب كل مرحلة.', 'Welcome to Archangelos School of Deacons, a learning library for hymns, Coptic, and church liturgy, with a path for every age and level.'],
    ['مدرسة أرشى أنجيلوس للشمامسة مساحة تعليمية تساعد الطلاب على التدرّج في تعلّم الألحان واللغة القبطية والطقس الكنسي، من رياض الأطفال حتى خورس الشمامسة.', 'Archangelos School of Deacons helps students grow in hymns, Coptic, and church liturgy—from kindergarten through the Deacons’ Choir.'],
    ['مدرسة أرشى أنجيلوس للشمامسة (Archangelos School of Deacons) مساحة تعليمية تساعد الطلاب على التدرّج في تعلّم الألحان واللغة القبطية والطقس الكنسي، من رياض الأطفال حتى خورس الشمامسة.', 'Archangelos School of Deacons helps students grow in hymns, Coptic, and church liturgy—from kindergarten through the Deacons’ Choir.'],
    ['مدرسة أرشى أنجيلوس للشمامسة', 'Archangelos School of Deacons'],
    ['شعار مدرسة أرشى أنجيلوس للشمامسة', 'Archangelos School of Deacons logo'],
    ['أنت غير متصل بالإنترنت — قد تظهر قائمة المواد والملفات الصغيرة التي فُتحت سابقًا؛ تشغيل الوسائط الكبيرة يحتاج إلى اتصال.', 'You are offline. Previously loaded materials and small files may be available; larger media needs a connection.'],
    ['التنقل الرئيسي', 'Main navigation'], ['الصفحة الرئيسية', 'Home'], ['الرئيسية', 'Home'],
    ['الإعلانات', 'Announcements'], ['عن المدرسة', 'About the school'], ['اختيار المظهر', 'Choose appearance'],
    ['المظهر واللغة', 'Appearance and language'], ['إعدادات المظهر واللغة', 'Appearance and language settings'],
    ['اختيار المظهر', 'Choose appearance'], ['المظهر', 'Appearance'], ['اللغة', 'Language'], ['لغة التطبيق', 'App language'],
    ['اختيار العربية أو English يدويًا يتجاوز لغة الجهاز ويظل محفوظًا.', 'Choosing Arabic or English manually overrides the device language and stays saved.'],
    ['حسب الجهاز', 'System'], ['حسب لغة الجهاز', 'Use device language'], ['فاتح', 'Light'], ['داكن', 'Dark'],
    ['الإشعارات', 'Notifications'], ['فعّل إشعارات المواد الجديدة', 'Enable new material notifications'],
    ['إشعارات المحتوى مفعّلة', 'New material notifications are enabled'],
    ['إشعارات المتصفح محظورة. غيّر الإذن من إعدادات المتصفح.', 'Browser notifications are blocked. Change the permission in your browser settings.'],
    ['إشعارات المتصفح تحتاج إلى اتصال آمن (HTTPS).', 'Browser notifications require a secure (HTTPS) connection.'],
    ['الإشعارات غير مدعومة في هذا المتصفح', 'Notifications are not supported in this browser'],
    ['تم تفعيل إشعارات المحتوى الجديد.', 'New material notifications enabled.'],
    ['تعذّر تفعيل الإشعارات في هذا المتصفح.', 'Could not enable notifications in this browser.'],
    ['العربية', 'العربية'], ['English', 'English'], ['تثبيت التطبيق', 'Install app'], ['فتح القائمة', 'Open menu'],
    ['مدرسة أرشى أنجيلوس للشمامسة', 'Archangelos School of Deacons'],
    ['لخدمة الشمامسة', 'Serving deacons'], ['تطبيق تعليمي يعمل على الهاتف والكمبيوتر.', 'A learning app for phones and computers.'],
    ['رتّلوا للرب ترنيمة جديدة', 'Sing a new song to the Lord'], ['أضف المدرسة إلى شاشتك', 'Add the school to your home screen'], ['أضف التطبيق إلى شاشة جهازك', 'Add the app to your home screen'],
    ['إغلاق', 'Close'], ['على iPhone أو iPad: اضغط زر المشاركة في Safari، ثم اختر', 'On iPhone or iPad: tap Share in Safari, then choose'],
    ['إضافة إلى الشاشة الرئيسية', 'Add to Home Screen'], ['على الكمبيوتر أو Android: افتح قائمة المتصفح واختر', 'On a computer or Android: open the browser menu and choose'],
    ['أو', 'or'], ['إعلانات وإرشادات', 'News and guides'], ['نتعلّم ونرتّل ونخدم بمحبة.', 'Learning, chanting, and serving with love.'],

    ['رياض الأطفال', 'Kindergarten'], ['روضة الملائكة', 'Angels Kindergarten'], ['بدايتنا مع التسبيح والتعلّم بمحبة.', 'A joyful start to praise and learning.'],
    ['الصفان الأول والثاني', 'Grades 1 & 2'], ['المرحلة الأولى', 'Level 1'], ['خطوات أولى في الألحان واللغة والطقس.', 'First steps in hymns, language, and liturgy.'],
    ['الصفان الثالث والرابع', 'Grades 3 & 4'], ['٣–٤', '3–4'], ['المرحلة الثانية', 'Level 2'], ['نتدرّب على المعرفة والترتيل والخدمة.', 'Growing in knowledge, chanting, and service.'],
    ['الصفان الخامس والسادس', 'Grades 5 & 6'], ['٥–٦', '5–6'], ['المرحلة الثالثة', 'Level 3'], ['نعمّق فهمنا ونوسّع مكتبتنا التعليمية.', 'Deepening understanding and learning.'],
    ['المرحلة الإعدادية', 'Middle School'], ['إعدادي', 'Middle School'], ['مواد تناسب مرحلة النمو والمسؤولية.', 'Learning for a time of growth and responsibility.'],
    ['المرحلة الثانوية', 'High School'], ['ثانوي', 'High School'], ['استعداد أعمق للخدمة والمعرفة الكنسية.', 'Preparing for deeper service and church knowledge.'],
    ['خورس الشمامسة', 'Deacons’ Choir'], ['الخورس', 'The Choir'], ['الخريجون والمستويات المتقدمة', 'Graduates and advanced learners'], ['مواد متقدمة لخدمة الخورس والترتيل.', 'Advanced materials for choir service and chanting.'],
    ['الألحان', 'Hymns'], ['اللغة القبطية', 'Coptic language'], ['الطقس الكنسي', 'Church liturgy'],
    ['ألحان الكنيسة وتسابيحها مع مواد الاستماع والتدريب.', 'Church hymns and praises, with listening and practice materials.'],
    ['دروس الحروف والكلمات والقراءات باللغة القبطية.', 'Coptic letters, words, and readings.'],
    ['شرح مبسّط للطقوس والخدمة الكنسية.', 'Clear guides to church rites and service.'],
    ['الفصل الدراسي الأول', 'First term'], ['الفصل الدراسي الثاني', 'Second term'], ['الفصل الدراسي الثالث', 'Third term'],
    ['مواد ودروس الفصل الأول', 'Lessons and materials for the first term'], ['مواد ودروس الفصل الثاني', 'Lessons and materials for the second term'], ['مواد ودروس الفصل الثالث', 'Lessons and materials for the third term'],
    ['إعلان تعريفي', 'Welcome'], ['دليل الاستخدام', 'Getting started'], ['ميزة التطبيق', 'App feature'],
    ['مساحة تعليمية تجمع مواد الألحان واللغة القبطية والطقس الكنسي، مرتبة حسب المرحلة والفصل الدراسي.', 'A learning space for hymns, Coptic, and church liturgy, organized by level and term.'],
    ['اختر المرحلة، ثم المادة والفصل الدراسي للوصول إلى الدروس والملفات المتاحة.', 'Choose a level, subject, and term to find lessons and files.'],
    ['يمكن تثبيت هذه المكتبة من المتصفح للوصول إليها بسهولة على الهاتف أو الكمبيوتر.', 'Install this library from your browser for quick access on your phone or computer.'],

    ['نرتّل ونتعلّم ونخدم', 'Chant, learn, and serve'], ['في رحاب الكنيسة،', 'In the life of the Church,'], ['يكبر صوت الخدمة', 'the voice of service grows'],
    ['اكتشف المراحل', 'Explore levels'], ['تعرّف على المدرسة', 'About the school'], ['لجميع الأعمار والمراحل', 'For every age and level'],
    ['مواد سهلة الوصول', 'Learning made accessible'], ['تعلّم واستمع ورتّل', 'Learn, listen, and chant'], ['حروف وكلمات وقراءات', 'Letters, words, and readings'], ['افهم ترتيب الخدمة', 'Understand the service'],
    ['مسارك التعليمي', 'Your learning path'], ['اختر مرحلتك الدراسية', 'Choose your level'],
    ['لكل مرحلة مواد مرتبة حسب المادة والفصل الدراسي.', 'Materials are organized by subject and term for every level.'],
    ['كل المراحل ←', 'All levels →'], ['من أخبار المدرسة', 'From the school'], ['إعلانات وإرشادات', 'News and guides'],
    ['كل ما يساعدك على استخدام المكتبة ومتابعة موادها.', 'Helpful information for using the library and following its materials.'], ['عرض الكل ←', 'View all →'],
    ['مرحبًا بكم', 'Welcome'], ['المراحل الدراسية', 'School levels'], ['اختر المرحلة لعرض المواد والفصول المتاحة.', 'Choose a level to view its subjects and terms.'],
    ['تصفّح المواد حسب مرحلتك الدراسية', 'Browse materials by school level'], ['محتويات المكتبة', 'Library contents'],
    ['المواد الدراسية', 'Subjects'], ['اختر مادة للمتابعة', 'Choose a subject'], ['تظهر مواد الفصل الدراسي داخل كل مادة.', 'Each subject contains materials arranged by term.'],
    ['ثلاثة فصول دراسية', 'Three terms'], ['ابدأ التصفّح', 'Start exploring'],
    ['تقسيم المحتوى', 'Browse by term'], ['اختر الفصل الدراسي', 'Choose a term'], ['افتح الفصل لعرض الدروس والملفات المضافة إليه.', 'Open a term to view its lessons and files.'],
    ['لم تُضف مواد بعد', 'No materials yet'], ['تقارير', 'Reports'],
    ['ملف صوتي', 'Audio file'], ['فيديو', 'Video'], ['مستند PDF', 'PDF document'], ['صورة', 'Image'],
    ['المتصفح لا يدعم تشغيل الصوت.', 'Your browser cannot play this audio.'], ['المتصفح لا يدعم تشغيل الفيديو.', 'Your browser cannot play this video.'],
    ['فتح / تنزيل المادة', 'Open / download material'], ['المكتبة تستعد لاستقبال مواد هذا الفصل', 'This term’s library is ready for its first materials'],
    ['لم تتم إضافة مواد إلى هذا القسم بعد. يمكن للمسؤول إضافة تسجيلات صوتية أو فيديوهات أو ملفات PDF أو صور من لوحة إدارة المحتوى.', 'No materials have been added here yet. An administrator can add audio, video, PDF documents, or images from the content manager.'],
    ['إدارة المحتوى', 'Manage content'], ['لا توجد مواد منشورة بعد', 'No materials published yet'], ['إضافة مادة', 'Add material'],
    ['الإعلانات والإرشادات', 'Announcements and guides'], ['رسائل تساعدك على التعرّف إلى المكتبة واستخدامها.', 'Helpful information about the library and how to use it.'],
    ['تنويه', 'Note'], ['هذه الإعلانات إرشادية افتراضية في النسخة الأولية. أضف الأخبار الفعلية عند ربط الموقع بمصدر إدارة المدرسة.', 'These are sample notices. Replace them with school announcements when connecting the app to the school’s content source.'],
    ['نتعلّم بمحبة', 'Learning with love'], ['نتعلّم ونرتّل ونخدم', 'Learn, chant, and serve'],
    ['مدرسة أرشى أنجيلوس للشمامسة مساحة تعليمية تساعد الطلاب على التدرّج في تعلّم الألحان واللغة القبطية والطقس الكنسي، من رياض الأطفال حتى خورس الشمامسة.', 'Archangelos School of Deacons helps students grow in hymns, Coptic, and church liturgy—from kindergarten through the Deacons’ Choir.'],
    ['صُممت المكتبة لتكون واضحة على الهاتف والكمبيوتر، وتجمع مواد كل مرحلة في مكان واحد، مع إمكان تثبيت التطبيق وعرض قائمة المواد التي فُتحت سابقًا عند انقطاع الإنترنت. تشغيل ملفات الوسائط الكبيرة يحتاج إلى اتصال.', 'The library is designed for phones and computers. It brings each level’s materials together, can be installed, and can show a previously loaded materials list offline. Large media files need a connection.'],
    ['تعلّم الألحان بالتدرّج والاستماع', 'Learn hymns step by step and by listening'], ['التعرّف إلى اللغة القبطية', 'Explore the Coptic language'], ['فهم الطقس والخدمة الكنسية', 'Understand church rites and service'],

    ['تعديل المادة', 'Edit material'], ['إضافة مادة تعليمية', 'Add learning material'], ['أضف ملفًا من جهازك أو رابط فيديو. تحفظ المواد في هذا المتصفح.', 'Add a file from your device or a video link. Materials are saved in this browser.'],
    ['عنوان المادة', 'Title'], ['مثال: لحن تين أوأوشت', 'Example: Ten O Ousht hymn'], ['المرحلة', 'Level'], ['اختر المرحلة', 'Choose a level'], ['المادة', 'Subject'], ['اختر المادة', 'Choose a subject'],
    ['الفصل الدراسي', 'Term'], ['اختر الفصل الدراسي', 'Choose a term'], ['نوع المحتوى', 'Content type'], ['اختر نوع المحتوى', 'Choose a content type'], ['وصف مختصر', 'Short description'], ['أضف شرحًا يساعد الطالب على الاستفادة من المادة', 'Add a description to help students use this material'],
    ['رفع ملف من الجهاز', 'Upload a file from this device'], ['توجد نسخة مرفوعة. اختر ملفًا جديدًا لاستبدالها.', 'A file is already uploaded. Choose a new file to replace it.'],
    ['للملفات الكبيرة، استخدم رابطًا مباشرًا أو رابط YouTube.', 'For large files, use a direct link or a YouTube link.'], ['أو رابط مباشر / YouTube', 'Or a direct link / YouTube'],
    ['روابط YouTube تُعرض داخل مشغّل الفيديو. أضف رابطًا مباشرًا لملف صوت أو PDF أو صورة عند الحاجة.', 'YouTube links appear in the video player. You can also add a direct link to audio, a PDF, or an image.'],
    ['حفظ التعديلات', 'Save changes'], ['إضافة إلى المكتبة', 'Add to library'], ['إلغاء التعديل', 'Cancel editing'], ['المواد المضافة', 'Added materials'],
    ['عرض', 'View'], ['تعديل', 'Edit'], ['حذف', 'Delete'], ['لم تُضف أي مواد بعد. أضف أول مادة من النموذج.', 'No materials yet. Add the first one using the form.'],
    ['أضف مواد كل مرحلة ومادة وفصل دراسي.', 'Add materials for each level, subject, and term.'], ['ملاحظة حول الحفظ', 'About storage'],
    ['الخادم المشترك غير متاح', 'Shared server unavailable'], ['تعذّر الاتصال بخادم المحتوى.', 'Could not connect to the content server.'],
    ['تعذّر الاتصال بالخادم', 'Could not connect to the server'],
    ['شغّل', 'Run'], ['من مجلد التطبيق، ثم افتح', 'from the app folder, then open'],
    ['لإدارة المحتوى ومزامنته بين الأجهزة. لا تُحفظ التغييرات أثناء انقطاع الخادم.', 'to manage content and sync it across devices. Changes cannot be saved while the server is offline.'],
    ['إعادة المحاولة', 'Try again'], ['دخول المسؤول', 'Administrator sign in'],
    ['سجّل الدخول لإدارة مكتبة المدرسة المشتركة.', 'Sign in to manage the shared school library.'],
    ['المواد المنشورة متاحة للطلاب، وتحتاج إضافة المواد أو تعديلها إلى حساب مسؤول.', 'Published materials are available to students. An administrator account is required to add or edit content.'],
    ['اسم المستخدم', 'Username'], ['كلمة المرور', 'Password'], ['تسجيل الدخول', 'Sign in'], ['تسجيل الخروج', 'Sign out'],
    ['التخزين المشترك متصل', 'Shared storage connected'],
    ['تُحفظ الملفات والمواد على خادم المدرسة، وتظهر لكل المستخدمين والأجهزة.', 'Materials and files are saved on the school server and shared across users and devices.'],
    ['وضع معاينة محلي', 'Local preview mode'],
    ['أنت تفتح الملف مباشرة؛ التغييرات هنا تخص هذا المتصفح فقط. للتخزين المشترك شغّل الخادم وافتح التطبيق عبر', 'You opened the file directly; changes here stay in this browser. For shared storage, start the server and open the app at'],
    ['أضف ملفًا من جهازك أو رابط فيديو. تحفظ المواد على الخادم المشترك.', 'Upload a file or add a video link. Materials are saved to the shared server.'],
    ['توجد نسخة مرفوعة. اختر ملفًا جديدًا لاستبدالها.', 'An uploaded copy already exists. Choose another file to replace it.'],
    ['تعذّر تسجيل الدخول', 'Sign-in failed'], ['تعذّر تحميل مواد الخادم.', 'Could not load server materials.'],
    ['تعذّر حفظ المادة على الخادم.', 'Could not save material to the server.'], ['تعذّر حذف المادة من الخادم.', 'Could not delete material from the server.'],
    ['بيانات تسجيل الدخول غير صحيحة.', 'Incorrect username or password.'], ['تعذّر تسجيل الدخول.', 'Sign-in failed.'],
    ['تعذّر تسجيل الخروج.', 'Could not sign out.'], ['تم تسجيل الدخول بنجاح.', 'Signed in successfully.'], ['تم تسجيل الخروج.', 'Signed out.'],
    ['يمكنك تعديل المواد وحذفها من هذه القائمة.', 'Edit or delete materials from this list.'],
    ['لم نعثر على هذا القسم', 'We couldn’t find this section'], ['قد يكون الرابط غير صحيح أو أن القسم لم يعد متاحًا.', 'The link may be incorrect, or this section may no longer be available.'],
    ['لنعد إلى الصفحة الرئيسية', 'Let’s go back to the home page'], ['العودة للرئيسية', 'Back to home'],

    ['أدخل رابطًا صحيحًا يبدأ بـ https أو http.', 'Enter a valid link beginning with https or http.'], ['اختر رفع ملف أو إضافة رابط، وليس الاثنين معًا.', 'Choose a file upload or a link, not both.'],
    ['ارفع ملفًا من جهازك أو أضف رابطًا مباشرًا.', 'Upload a file from your device or add a direct link.'],
    ['تُحفظ الملفات والمواد في التخزين السحابي وتظهر لكل المستخدمين والأجهزة.', 'Files and materials are saved in cloud storage and shared across users and devices.'],
    ['أنت تفتح الملف مباشرة؛ التغييرات هنا تخص هذا المتصفح فقط. للتخزين السحابي شغّل', 'You opened the file directly; changes here stay in this browser. For local cloud-storage development, run'],
    ['نوع الملف لا يتوافق مع اختيار', 'The file type does not match the selected type:'], ['رابط الفيديو يجب أن يكون من YouTube أو ارفع ملف فيديو.', 'Use a YouTube link or upload a video file.'],
    ['أضف ملفًا أو رابطًا للمادة.', 'Add a file or link for this material.'], ['تم حفظ التعديلات.', 'Changes saved.'], ['أُضيفت المادة إلى المكتبة.', 'Material added to the library.'],
    ['تعذّر حفظ المادة. قد يكون الملف أكبر من مساحة التخزين المتاحة.', 'Could not save the material. The file may exceed available storage.'],
    ['امتداد الملف لا يتوافق مع نوع المحتوى المختار.', 'The file extension does not match the selected material type.'],
    ['تم بلوغ حد التخزين الآمن للخطة المجانية. احذف مواد قديمة أو راجع الحصة المتاحة.', 'The free storage safety limit has been reached. Delete older materials or review the available quota.'],
    ['حجم الملف يتجاوز الحد', 'The file is larger than the limit'],
    ['تحقّق من اتصال الموقع بواجهة Cloudflare Workers وتهيئة قاعدة البيانات والتخزين، ثم أعد المحاولة. لا تُحفظ التغييرات أثناء انقطاع الخادم.', 'Check the Cloudflare Workers API, database, and storage configuration, then retry. Changes cannot be saved while the server is offline.'],
    ['ارفع ملفًا يصل حجمه إلى', 'Upload a file up to'],
    ['هل تريد حذف «', 'Delete “'], ['»؟', '”?'], ['حُذفت المادة.', 'Material deleted.'], ['تعذّر حذف المادة.', 'Could not delete the material.'],
    ['تم تثبيت التطبيق بنجاح.', 'The app was installed successfully.'],
    ['١', '1'], ['٢', '2'], ['٣', '3'], ['٤', '4'], ['٥', '5'], ['٦', '6'], ['←', '→'], ['‹', '›']
  ];

  const orderedPairs = pairs.slice().sort((a, b) => b[0].length - a[0].length);
  const arabicOverrides = [
    ['Archangelos School of Deacons · مدرسة أرشى أنجيلوس للشمامسة', 'مدرسة أرشى أنجيلوس للشمامسة'],
    ['مرحبًا بكم في مكتبة Archangelos School of Deacons · مدرسة أرشى أنجيلوس للشمامسة', 'مرحبًا بكم في مكتبة مدرسة أرشى أنجيلوس للشمامسة'],
    ['Archangelos School of Deacons (مدرسة أرشى أنجيلوس للشمامسة)', 'مدرسة أرشى أنجيلوس للشمامسة'],
    ['مدرسة أرشى أنجيلوس للشمامسة (Archangelos School of Deacons)', 'مدرسة أرشى أنجيلوس للشمامسة'],
    ['مرحبًا بكم في Archangelos School of Deacons (مدرسة أرشى أنجيلوس للشمامسة)؛ مكتبة تعليمية تجمع الألحان واللغة القبطية والطقس الكنسي، في رحلة تناسب كل مرحلة.', 'مرحبًا بكم في مدرسة أرشى أنجيلوس للشمامسة؛ مكتبة تعليمية تجمع الألحان واللغة القبطية والطقس الكنسي، في رحلة تناسب كل مرحلة.'],
    ['مدرسة أرشى أنجيلوس للشمامسة (Archangelos School of Deacons) مساحة تعليمية تساعد الطلاب على التدرّج في تعلّم الألحان واللغة القبطية والطقس الكنسي، من رياض الأطفال حتى خورس الشمامسة.', 'مدرسة أرشى أنجيلوس للشمامسة مساحة تعليمية تساعد الطلاب على التدرّج في تعلّم الألحان واللغة القبطية والطقس الكنسي، من رياض الأطفال حتى خورس الشمامسة.']
  ].sort((a, b) => b[0].length - a[0].length);
  const reverseByTarget = new Map();
  for (const [source, target] of pairs) {
    const existing = reverseByTarget.get(target);
    if (!existing || source.length < existing.length) reverseByTarget.set(target, source);
  }
  const reversePairs = [...reverseByTarget.entries()].sort((a, b) => b[0].length - a[0].length);
  function translate(value, locale) {
    let result = String(value);
    if (locale === 'en') {
      for (const [source, target] of orderedPairs) result = result.split(source).join(target);
      result = result.replace(/(\d+)\s+مادة تعليمية/g, (_, n) => `${n} ${n === '1' ? 'learning item' : 'learning items'}`)
        .replace(/(\d+)\s+مادة/g, (_, n) => `${n} ${n === '1' ? 'item' : 'items'}`);
    } else {
      for (const [source, target] of arabicOverrides) result = result.split(source).join(target);
      for (const [target, source] of reversePairs) result = result.split(target).join(source);
      result = result.replace(/(\d+) learning items?/g, '$1 مادة تعليمية').replace(/(\d+) items?/g, '$1 مادة');
    }
    return result;
  }
  window.ArchangelosI18n = { translate };
})();
