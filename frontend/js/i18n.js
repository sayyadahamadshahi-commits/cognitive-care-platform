/**
 * i18n.js — Centralized multilingual translation module
 * Languages: English (en), Hindi (hi), Assamese (as), Bengali (bn)
 * Usage:
 *   I18n.init()          — call once at app start
 *   I18n.setLanguage('hi') — switch language (persists via localStorage)
 *   I18n.t('key')        — translate a key
 * HTML: add data-i18n="key" attribute; I18n.applyAll() updates all elements
 */

const I18n = (() => {
  // ─── Translation Dictionary ────────────────────────────────────────────────
  const TRANSLATIONS = {
    en: {
      // App / Chrome
      'app.title': 'Cognitive Care Platform',
      'app.version': 'v1.0.0 · 12 tasks + 12 questionnaires + 5 protocols',

      // Sidebar nav
      'nav.dashboard': 'Dashboard',
      'nav.patients': 'Patients',
      'nav.assessments': 'Assessments',
      'nav.reports': 'Reports',
      'nav.assistant': 'AI Assistant',
      'nav.messages': 'Messages',
      'nav.caregiver_hub': 'Patient Hub',
      'nav.calls': 'Calls',
      'nav.logout': 'Log out',

      // Dashboard
      'dashboard.title': 'Dashboard',
      'dashboard.description': 'Patient analytics and assessment overview.',
      'dashboard.system_status': 'System Status',
      'dashboard.loading': 'Loading…',

      // Patient welcome
      'patient.welcome': 'Welcome Back',
      'patient.welcome_morning': 'Good morning',
      'patient.welcome_afternoon': 'Good afternoon',
      'patient.welcome_evening': 'Good evening',
      'patient.subtitle': 'Your daily cognitive care dashboard. Select an activity below:',

      // Patient action cards
      'action.take_assessment': 'Take Assessment',
      'action.take_assessment_desc': 'Start daily cognitive exercises',
      'action.talk_caregiver': 'Talk to Caregiver',
      'action.talk_caregiver_desc': 'Send messages to care team',
      'action.call_doctor': 'Call Doctor',
      'action.call_doctor_desc': 'Voice or video call your attending doctor',
      'action.call_caregiver': 'Call Caregiver',
      'action.call_caregiver_desc': 'Voice or video call care team',
      'doctor.section_title': 'My Doctor',
      'doctor.call_btn': 'Call Doctor',
      'doctor.no_doctor': 'No doctor assigned yet.',
      'action.ai_assistant': 'AI Assistant',
      'action.ai_assistant_desc': 'Get help & advice',
      'action.my_progress': 'My Progress',
      'action.my_progress_desc': 'View domain scores & trends',
      'action.help_support': 'Help & Support',
      'action.help_support_desc': 'Platform guidance & help',

      // Today's Routine
      'routine.title': "Today's Routine",
      'routine.subtitle': 'Your personalized daily cognitive plan',
      'routine.progress_label': 'completed today',
      'routine.empty': 'Complete activities to see your progress here.',
      'routine.start': 'Start',
      'routine.done': 'Done ✓',
      'routine.morning_checkin': 'Morning Check-in',
      'routine.morning_checkin_desc': 'Warm up your memory',
      'routine.memory': 'Memory',
      'routine.memory_desc': 'Practice associative memory',
      'routine.focus': 'Focus',
      'routine.focus_desc': 'Sharpen attention & concentration',
      'routine.thinking': 'Thinking',
      'routine.thinking_desc': 'Logical & spatial reasoning',
      'routine.break': 'Mindful Break',
      'routine.break_desc': 'Rest & breathe',
      'routine.communication': 'Communication',
      'routine.communication_desc': 'Word & language tasks',
      'routine.evening_checkin': 'Evening Check-in',
      'routine.evening_checkin_desc': 'Review and relax',

      // Progress section
      'progress.title': '🧠 Memory & Cognition Progress',
      'progress.no_data': 'No assessment data yet. Start an assessment to see your scores.',
      'progress.sessions_label': 'Recent Sessions (past 4 weeks)',
      'progress.session_count': '{n} session(s)',

      // Assessments
      'assessments.title': 'Assessments',
      'assessments.description': 'Run cognitive tasks and questionnaires.',
      'assessments.start_protocol': 'Start Protocol',
      'assessments.select_task': 'Select Task',

      // Task names (12 tasks)
      'task.spatial_span': 'Spatial Span',
      'task.token_search': 'Token Search',
      'task.number_ladder': 'Number Ladder',
      'task.paired_associates': 'Paired Associates',
      'task.rotations': 'Rotations',
      'task.polygons': 'Polygons',
      'task.odd_one_out': 'Odd One Out',
      'task.spatial_planning': 'Spatial Planning',
      'task.feature_match': 'Feature Match',
      'task.double_trouble': 'Double Trouble',
      'task.grammatical_reasoning': 'Grammatical Reasoning',
      'task.digit_span': 'Digit Span',

      // Task descriptions
      'task.spatial_span.desc': 'Remember and reproduce sequences of spatial locations',
      'task.token_search.desc': 'Search a grid for tokens without revisiting locations',
      'task.number_ladder.desc': 'Calculate steps up or down a number ladder',
      'task.paired_associates.desc': 'Learn and recall pairs of objects and locations',
      'task.rotations.desc': 'Mentally rotate 3D shapes to find matching pairs',
      'task.polygons.desc': 'Identify and match geometric polygon shapes',
      'task.odd_one_out.desc': 'Find the item that does not fit the group rule',
      'task.spatial_planning.desc': 'Plan the most efficient route through a grid',
      'task.feature_match.desc': 'Rapidly match objects sharing a target feature',
      'task.double_trouble.desc': 'Name the ink colour while ignoring the word text',
      'task.grammatical_reasoning.desc': 'Verify whether sentences accurately describe images',
      'task.digit_span.desc': 'Recall sequences of digits in forward or reverse order',

      // Task cognitive domains
      'domain.STM': 'Short-Term Memory',
      'domain.Reasoning': 'Reasoning',
      'domain.Verbal': 'Verbal',
      'domain.Concentration': 'Concentration',

      // Reports
      'reports.title': 'Reports',
      'reports.description': 'Generate clinical assessment reports with visualizations.',

      // AI Assistant
      'assistant.title': 'AI Assistant',
      'assistant.description': 'Talk or type with the assistant. It reads patient scores and builds a personalized routine.',
      'assistant.placeholder': 'Type a message or tap the mic to speak…',
      'assistant.send': 'Send',
      'assistant.build_routine': 'Build my routine',
      'assistant.how_doing': 'How am I doing?',
      'assistant.today_practice': "Today's practice",
      'assistant.patient_snapshot': 'Patient Snapshot',
      'assistant.select_patient': 'Select a patient to load their imported scores and history.',

      // Messages
      'messages.title': 'Messages',
      'messages.description': 'Message your care team.',
      'messages.placeholder': 'Type a message…',
      'messages.send': 'Send',
      'messages.select_patient': 'Select a patient above to view their message thread.',

      // Caregiver Hub
      'caregiver.hub_title': 'Patient Monitoring Hub',
      'caregiver.hub_description': 'Your assigned patients — recent activity and care status.',
      'caregiver.no_patients': 'No patients assigned yet.',
      'caregiver.contact': 'Contact',
      'caregiver.view': 'View',

      // Call modal
      'call.title': 'Start a Call',
      'call.select_mode': 'Select call mode:',
      'call.voice': '🎙️ Voice Call',
      'call.video': '📹 Video Call',
      'call.cancel': 'Cancel',
      'call.end': 'End Call',
      'call.mute': 'Mute',
      'call.unmute': 'Unmute',
      'call.connecting': 'Connecting…',
      'call.connected': 'Connected',
      'call.ended': 'Call ended',

      // Dedicated Calls View
      'calls.title': 'Calls',
      'calls.subtitle': 'Connect with your care team via live voice and video calls.',
      'calls.search_placeholder': 'Search contacts or call history...',
      'calls.filter_all': 'All',
      'calls.filter_missed': 'Missed',
      'calls.filter_incoming': 'Incoming',
      'calls.filter_outgoing': 'Outgoing',
      'calls.filter_video': 'Video',
      'calls.filter_voice': 'Voice',
      'calls.contacts': 'Available Contacts',
      'calls.recent': 'Call History & Missed Calls',
      'calls.no_calls': 'No call history recorded yet.',
      'calls.no_calls_desc': 'Use the contacts section above to start a live voice or video call.',

      // Auth
      'auth.login': 'Log In',
      'auth.register': 'Register',
      'auth.username': 'Username',
      'auth.password': 'Password',
      'auth.name': 'Full Name',
      'auth.role': 'Role',
      'auth.role_doctor': 'Doctor',
      'auth.role_caregiver': 'Caregiver',
      'auth.role_patient': 'Patient',
      'auth.have_account': 'Already have an account?',
      'auth.no_account': "Don't have an account?",

      // Language selector
      'lang.select': 'Language',
      'lang.en': 'English',
      'lang.hi': 'हिन्दी (Hindi)',
      'lang.as': 'অসমীয়া (Assamese)',
      'lang.bn': 'বাংলা (Bengali)',
    },

    // ─── HINDI (hi) ──────────────────────────────────────────────────────────
    hi: {
      'app.title': 'कॉग्निटिव केयर प्लेटफॉर्म',
      'app.version': 'v1.0.0 · 12 कार्य + 12 प्रश्नावली + 5 प्रोटोकॉल',

      'nav.dashboard': 'डैशबोर्ड',
      'nav.patients': 'मरीज़',
      'nav.assessments': 'मूल्यांकन',
      'nav.reports': 'रिपोर्ट',
      'nav.assistant': 'AI सहायक',
      'nav.messages': 'संदेश',
      'nav.caregiver_hub': 'मरीज़ केंद्र',
      'nav.calls': 'कॉल्स',
      'nav.logout': 'लॉग आउट',

      'dashboard.title': 'डैशबोर्ड',
      'dashboard.description': 'मरीज़ विश्लेषण और मूल्यांकन अवलोकन।',
      'dashboard.system_status': 'सिस्टम स्थिति',
      'dashboard.loading': 'लोड हो रहा है…',

      'patient.welcome': 'वापसी पर स्वागत है',
      'patient.welcome_morning': 'सुप्रभात',
      'patient.welcome_afternoon': 'शुभ दोपहर',
      'patient.welcome_evening': 'शुभ संध्या',
      'patient.subtitle': 'आपका दैनिक संज्ञानात्मक देखभाल डैशबोर्ड। नीचे कोई गतिविधि चुनें:',

      'action.take_assessment': 'मूल्यांकन करें',
      'action.take_assessment_desc': 'दैनिक संज्ञानात्मक अभ्यास शुरू करें',
      'action.talk_caregiver': 'देखभालकर्ता से बात करें',
      'action.talk_caregiver_desc': 'देखभाल टीम को संदेश भेजें',
      'action.call_doctor': 'डॉक्टर को कॉल करें',
      'action.call_doctor_desc': 'अपने डॉक्टर को आवाज़ या वीडियो कॉल करें',
      'action.call_caregiver': 'देखभालकर्ता को कॉल करें',
      'action.call_caregiver_desc': 'आवाज़ या वीडियो कॉल करें',
      'doctor.section_title': 'मेरे डॉक्टर',
      'doctor.call_btn': 'डॉक्टर को कॉल करें',
      'doctor.no_doctor': 'अभी तक कोई डॉक्टर नियुक्त नहीं है।',
      'action.ai_assistant': 'AI सहायक',
      'action.ai_assistant_desc': 'मदद और सलाह पाएं',
      'action.my_progress': 'मेरी प्रगति',
      'action.my_progress_desc': 'स्कोर और रुझान देखें',
      'action.help_support': 'सहायता',
      'action.help_support_desc': 'प्लेटफॉर्म मार्गदर्शन और सहायता',

      'routine.title': 'आज की दिनचर्या',
      'routine.subtitle': 'आपकी व्यक्तिगत दैनिक संज्ञानात्मक योजना',
      'routine.progress_label': 'आज पूरे हुए',
      'routine.empty': 'अपनी प्रगति देखने के लिए गतिविधियाँ पूरी करें।',
      'routine.start': 'शुरू करें',
      'routine.done': 'पूर्ण ✓',
      'routine.morning_checkin': 'सुबह की जाँच',
      'routine.morning_checkin_desc': 'स्मृति को गर्म करें',
      'routine.memory': 'स्मृति',
      'routine.memory_desc': 'साहचर्य स्मृति का अभ्यास',
      'routine.focus': 'ध्यान',
      'routine.focus_desc': 'ध्यान और एकाग्रता तेज करें',
      'routine.thinking': 'सोच',
      'routine.thinking_desc': 'तार्किक और स्थानिक तर्क',
      'routine.break': 'माइंडफुल ब्रेक',
      'routine.break_desc': 'आराम करें और सांस लें',
      'routine.communication': 'संचार',
      'routine.communication_desc': 'शब्द और भाषा कार्य',
      'routine.evening_checkin': 'शाम की जाँच',
      'routine.evening_checkin_desc': 'समीक्षा करें और आराम करें',

      'progress.title': '🧠 स्मृति और संज्ञान प्रगति',
      'progress.no_data': 'अभी तक कोई मूल्यांकन डेटा नहीं। अपने स्कोर देखने के लिए मूल्यांकन शुरू करें।',
      'progress.sessions_label': 'हालिया सत्र (पिछले 4 सप्ताह)',
      'progress.session_count': '{n} सत्र',

      'assessments.title': 'मूल्यांकन',
      'assessments.description': 'संज्ञानात्मक कार्य और प्रश्नावली चलाएं।',

      'task.spatial_span': 'स्थानिक विस्तार',
      'task.token_search': 'टोकन खोज',
      'task.number_ladder': 'संख्या सीढ़ी',
      'task.paired_associates': 'जोड़ी सहयोगी',
      'task.rotations': 'घुमाव',
      'task.polygons': 'बहुभुज',
      'task.odd_one_out': 'अलग एक निकालो',
      'task.spatial_planning': 'स्थानिक योजना',
      'task.feature_match': 'विशेषता मिलान',
      'task.double_trouble': 'दोहरी कठिनाई',
      'task.grammatical_reasoning': 'व्याकरणिक तर्क',
      'task.digit_span': 'अंक विस्तार',

      'task.spatial_span.desc': 'स्थानिक स्थानों के क्रम याद करें और दोहराएं',
      'task.token_search.desc': 'स्थानों को दोबारा जाए बिना ग्रिड में टोकन खोजें',
      'task.number_ladder.desc': 'संख्या सीढ़ी पर चरणों की गणना करें',
      'task.paired_associates.desc': 'वस्तुओं और स्थानों की जोड़ियाँ सीखें और याद करें',
      'task.rotations.desc': 'मेल खाने वाली जोड़ियाँ खोजने के लिए 3D आकृतियाँ घुमाएं',
      'task.polygons.desc': 'ज्यामितीय बहुभुज आकृतियाँ पहचानें और मिलाएं',
      'task.odd_one_out.desc': 'वह वस्तु खोजें जो समूह के नियम में नहीं आती',
      'task.spatial_planning.desc': 'ग्रिड से सबसे कुशल मार्ग की योजना बनाएं',
      'task.feature_match.desc': 'लक्ष्य विशेषता साझा करने वाली वस्तुओं को तेज़ी से मिलाएं',
      'task.double_trouble.desc': 'शब्द को नज़रअंदाज़ करते हुए स्याही का रंग बोलें',
      'task.grammatical_reasoning.desc': 'जाँचें कि वाक्य चित्रों का सटीक वर्णन करते हैं या नहीं',
      'task.digit_span.desc': 'आगे या उल्टे क्रम में अंकों के अनुक्रम याद करें',

      'domain.STM': 'अल्पकालिक स्मृति',
      'domain.Reasoning': 'तर्क',
      'domain.Verbal': 'मौखिक',
      'domain.Concentration': 'एकाग्रता',

      'reports.title': 'रिपोर्ट',
      'reports.description': 'दृश्यों के साथ नैदानिक मूल्यांकन रिपोर्ट तैयार करें।',

      'assistant.title': 'AI सहायक',
      'assistant.description': 'सहायक के साथ बात करें या टाइप करें।',
      'assistant.placeholder': 'संदेश टाइप करें या माइक दबाएं…',
      'assistant.send': 'भेजें',
      'assistant.build_routine': 'मेरी दिनचर्या बनाएं',
      'assistant.how_doing': 'मैं कैसा कर रहा हूं?',
      'assistant.today_practice': 'आज का अभ्यास',
      'assistant.patient_snapshot': 'मरीज़ सारांश',
      'assistant.select_patient': 'उनके इम्पोर्टेड स्कोर और इतिहास लोड करने के लिए कोई मरीज़ चुनें।',

      'messages.title': 'संदेश',
      'messages.description': 'अपनी देखभाल टीम को संदेश भेजें।',
      'messages.placeholder': 'संदेश टाइप करें…',
      'messages.send': 'भेजें',
      'messages.select_patient': 'उनका संदेश धागा देखने के लिए ऊपर मरीज़ चुनें।',

      'caregiver.hub_title': 'मरीज़ निगरानी केंद्र',
      'caregiver.hub_description': 'आपके नियुक्त मरीज़ — हालिया गतिविधि और देखभाल स्थिति।',
      'caregiver.no_patients': 'अभी तक कोई मरीज़ नियुक्त नहीं।',
      'caregiver.contact': 'संपर्क',
      'caregiver.view': 'देखें',

      'call.title': 'कॉल शुरू करें',
      'call.select_mode': 'कॉल मोड चुनें:',
      'call.voice': '🎙️ आवाज़ कॉल',
      'call.video': '📹 वीडियो कॉल',
      'call.cancel': 'रद्द करें',
      'call.end': 'कॉल समाप्त करें',
      'call.mute': 'म्यूट',
      'call.unmute': 'अनम्यूट',
      'call.connecting': 'जोड़ रहा है…',
      'call.connected': 'जुड़ा हुआ',
      'call.ended': 'कॉल समाप्त',

      // Dedicated Calls View
      'calls.title': 'कॉल्स',
      'calls.subtitle': 'लाइव वॉइस और वीडियो कॉल्स के माध्यम से अपनी देखभाल टीम से जुड़ें।',
      'calls.search_placeholder': 'संपर्क या कॉल इतिहास खोजें...',
      'calls.filter_all': 'सभी',
      'calls.filter_missed': 'छूटी हुई',
      'calls.filter_incoming': 'आने वाली',
      'calls.filter_outgoing': 'जाने वाली',
      'calls.filter_video': 'वीडियो',
      'calls.filter_voice': 'वॉइस',
      'calls.contacts': 'उपलब्ध संपर्क',
      'calls.recent': 'कॉल इतिहास और छूटी हुई कॉल्स',
      'calls.no_calls': 'अभी तक कोई कॉल इतिहास दर्ज नहीं है।',
      'calls.no_calls_desc': 'लाइव वॉइस या वीडियो कॉल शुरू करने के लिए ऊपर संपर्क अनुभाग का उपयोग करें।',

      'auth.login': 'लॉग इन',
      'auth.register': 'पंजीकरण',
      'auth.username': 'उपयोगकर्ता नाम',
      'auth.password': 'पासवर्ड',
      'auth.name': 'पूरा नाम',
      'auth.role': 'भूमिका',
      'auth.role_doctor': 'डॉक्टर',
      'auth.role_caregiver': 'देखभालकर्ता',
      'auth.role_patient': 'मरीज़',
      'auth.have_account': 'पहले से खाता है?',
      'auth.no_account': 'खाता नहीं है?',

      'lang.select': 'भाषा',
      'lang.en': 'English',
      'lang.hi': 'हिन्दी (Hindi)',
      'lang.as': 'অসমীয়া (Assamese)',
      'lang.bn': 'বাংলা (Bengali)',
    },

    // ─── ASSAMESE (as) ───────────────────────────────────────────────────────
    as: {
      'app.title': 'কগনিটিভ কেয়াৰ প্লেটফৰ্ম',
      'app.version': 'v1.0.0 · ১২ কাৰ্য + ১২ প্ৰশ্নাৱলী + ৫ প্ৰটোকল',

      'nav.dashboard': 'ডেচবোৰ্ড',
      'nav.patients': 'ৰোগী',
      'nav.assessments': 'মূল্যায়ন',
      'nav.reports': 'প্ৰতিবেদন',
      'nav.assistant': 'AI সহায়ক',
      'nav.messages': 'বাৰ্তা',
      'nav.caregiver_hub': 'ৰোগী কেন্দ্ৰ',
      'nav.calls': 'কলসমূহ',
      'nav.logout': 'লগ আউট',

      'dashboard.title': 'ডেচবোৰ্ড',
      'dashboard.description': 'ৰোগীৰ বিশ্লেষণ আৰু মূল্যায়নৰ অৱলোকন।',
      'dashboard.system_status': 'চিস্টেম স্থিতি',
      'dashboard.loading': 'লোড হৈছে…',

      'patient.welcome': 'আকৌ স্বাগতম',
      'patient.welcome_morning': 'শুভ পুৱা',
      'patient.welcome_afternoon': 'শুভ দুপৰীয়া',
      'patient.welcome_evening': 'শুভ সন্ধিয়া',
      'patient.subtitle': 'আপোনাৰ দৈনিক জ্ঞানমূলক যত্ন ডেচবোৰ্ড। তলত এটা কার্যকলাপ বাছক:',

      'action.take_assessment': 'মূল্যায়ন কৰক',
      'action.take_assessment_desc': 'দৈনিক জ্ঞানমূলক অভ্যাস আৰম্ভ কৰক',
      'action.talk_caregiver': 'যত্নশীলৰ সৈতে কথা পাতক',
      'action.talk_caregiver_desc': 'যত্ন দলক বাৰ্তা পঠাওক',
      'action.call_doctor': 'চিকিৎসকক কল কৰক',
      'action.call_doctor_desc': 'আপোনাৰ চিকিৎসকলৈ কণ্ঠ বা ভিডিঅ কল কৰক',
      'action.call_caregiver': 'যত্নশীলক কল কৰক',
      'action.call_caregiver_desc': 'কণ্ঠ বা ভিডিঅ কল কৰক',
      'doctor.section_title': 'মোৰ চিকিৎসক',
      'doctor.call_btn': 'চিকিৎসকক কল কৰক',
      'doctor.no_doctor': 'এতিয়ালৈকে কোনো চিকিৎসক নিযুক্ত হোৱা নাই।',
      'action.ai_assistant': 'AI সহায়ক',
      'action.ai_assistant_desc': 'সহায় আৰু পৰামৰ্শ পাওক',
      'action.my_progress': 'মোৰ অগ্ৰগতি',
      'action.my_progress_desc': 'স্কোৰ আৰু ধাৰা চাওক',
      'action.help_support': 'সহায়',
      'action.help_support_desc': 'প্লেটফৰ্ম নিৰ্দেশিকা আৰু সহায়',

      'routine.title': 'আজিৰ দৈনন্দিন',
      'routine.subtitle': 'আপোনাৰ ব্যক্তিগত দৈনিক জ্ঞানমূলক পৰিকল্পনা',
      'routine.progress_label': 'আজি সম্পূৰ্ণ',
      'routine.empty': 'আপোনাৰ অগ্ৰগতি চাবলৈ কার্যকলাপ সম্পূৰ্ণ কৰক।',
      'routine.start': 'আৰম্ভ কৰক',
      'routine.done': 'সম্পন্ন ✓',
      'routine.morning_checkin': 'পুৱাৰ পৰীক্ষা',
      'routine.morning_checkin_desc': 'আপোনাৰ স্মৃতি গৰম কৰক',
      'routine.memory': 'স্মৃতি',
      'routine.memory_desc': 'সহযোগী স্মৃতি অভ্যাস',
      'routine.focus': 'মনোযোগ',
      'routine.focus_desc': 'মনোযোগ আৰু একাগ্ৰতা তীক্ষ্ণ কৰক',
      'routine.thinking': 'চিন্তা',
      'routine.thinking_desc': 'যুক্তিগত আৰু স্থানিক যুক্তি',
      'routine.break': 'সচেতন বিৰতি',
      'routine.break_desc': 'জিৰণি লওক আৰু উশাহ লওক',
      'routine.communication': 'যোগাযোগ',
      'routine.communication_desc': 'শব্দ আৰু ভাষা কাৰ্য',
      'routine.evening_checkin': 'সন্ধিয়াৰ পৰীক্ষা',
      'routine.evening_checkin_desc': 'পৰ্যালোচনা কৰক আৰু বিৰাম লওক',

      'progress.title': '🧠 স্মৃতি আৰু জ্ঞান অগ্ৰগতি',
      'progress.no_data': 'এতিয়াও কোনো মূল্যায়ন ডেটা নাই। আপোনাৰ স্কোৰ চাবলৈ মূল্যায়ন আৰম্ভ কৰক।',
      'progress.sessions_label': 'শেহতীয়া অধিৱেশন (যোৱা ৪ সপ্তাহ)',
      'progress.session_count': '{n} টি অধিৱেশন',

      'assessments.title': 'মূল্যায়ন',
      'assessments.description': 'জ্ঞানমূলক কাৰ্য আৰু প্ৰশ্নাৱলী চলাওক।',

      'task.spatial_span': 'স্থানিক বিস্তাৰ',
      'task.token_search': 'টোকেন অনুসন্ধান',
      'task.number_ladder': 'সংখ্যা শিৰণী',
      'task.paired_associates': 'যুগ্মিত সহযোগী',
      'task.rotations': 'ঘূৰণ',
      'task.polygons': 'বহুভুজ',
      'task.odd_one_out': 'অদ্ভুত এজন উলিয়াওক',
      'task.spatial_planning': 'স্থানিক পৰিকল্পনা',
      'task.feature_match': 'বৈশিষ্ট্য মিলান',
      'task.double_trouble': 'দ্বৈত সমস্যা',
      'task.grammatical_reasoning': 'ব্যাকৰণমূলক যুক্তি',
      'task.digit_span': 'অংক বিস্তাৰ',

      'task.spatial_span.desc': 'স্থানিক অৱস্থানৰ ক্ৰম মনত ৰাখক আৰু পুনৰাবৃত্তি কৰক',
      'task.token_search.desc': 'অৱস্থান পুনৰ দেখা নোহোৱাকৈ গ্ৰিডত টোকেন বিচাৰক',
      'task.number_ladder.desc': 'সংখ্যা শিৰণীত ওপৰ বা তললৈ পদক্ষেপ গণনা কৰক',
      'task.paired_associates.desc': 'বস্তু আৰু অৱস্থানৰ যুগল শিকক আৰু স্মৰণ কৰক',
      'task.rotations.desc': 'মিলা যোৰা বিচাৰিবলৈ 3D আকৃতি মানসিকভাৱে ঘুৰাওক',
      'task.polygons.desc': 'জ্যামিতিক বহুভুজ আকৃতি চিনাক্ত কৰক আৰু মিলাওক',
      'task.odd_one_out.desc': 'গোটৰ নিয়মত নোসোমোৱা বস্তুটো বিচাৰক',
      'task.spatial_planning.desc': 'গ্ৰিডৰ মাজেৰে আটাইতকৈ দক্ষ পথ পৰিকল্পনা কৰক',
      'task.feature_match.desc': 'লক্ষ্য বৈশিষ্ট্য ভাগ কৰা বস্তুবোৰ দ্ৰুতভাৱে মিলাওক',
      'task.double_trouble.desc': 'শব্দটো আওকাণ কৰি কালিৰ ৰং কওক',
      'task.grammatical_reasoning.desc': 'বাক্যবোৰে ছবিৰ সঠিক বিৱৰণ দিছে নে নাই পৰীক্ষা কৰক',
      'task.digit_span.desc': 'আগলৈ বা উলটাকৈ অংকৰ ক্ৰম স্মৰণ কৰক',

      'domain.STM': 'স্বল্পমিয়াদী স্মৃতি',
      'domain.Reasoning': 'যুক্তি',
      'domain.Verbal': 'মৌখিক',
      'domain.Concentration': 'একাগ্ৰতা',

      'reports.title': 'প্ৰতিবেদন',
      'reports.description': 'দৃশ্যায়নসহ ক্লিনিকেল মূল্যায়ন প্ৰতিবেদন তৈয়াৰ কৰক।',

      'assistant.title': 'AI সহায়ক',
      'assistant.description': 'সহায়কৰ সৈতে কথা পাতক বা টাইপ কৰক।',
      'assistant.placeholder': 'বাৰ্তা টাইপ কৰক বা মাইক টিপক…',
      'assistant.send': 'পঠাওক',
      'assistant.build_routine': 'মোৰ দৈনন্দিন তৈয়াৰ কৰক',
      'assistant.how_doing': 'মই কেনেদৰে কৰিছো?',
      'assistant.today_practice': 'আজিৰ অভ্যাস',
      'assistant.patient_snapshot': 'ৰোগীৰ সাৰসংক্ষেপ',
      'assistant.select_patient': 'তেওঁলোকৰ আমদানি কৰা স্কোৰ আৰু ইতিহাস লোড কৰিবলৈ কোনো ৰোগী বাছক।',

      'messages.title': 'বাৰ্তা',
      'messages.description': 'আপোনাৰ যত্ন দলক বাৰ্তা দিয়ক।',
      'messages.placeholder': 'বাৰ্তা টাইপ কৰক…',
      'messages.send': 'পঠাওক',
      'messages.select_patient': 'তেওঁলোকৰ বাৰ্তা সূত্ৰ চাবলৈ ওপৰত ৰোগী বাছক।',

      'caregiver.hub_title': 'ৰোগী নিৰীক্ষণ কেন্দ্ৰ',
      'caregiver.hub_description': 'আপোনাৰ নিযুক্ত ৰোগীসকল — শেহতীয়া কার্যকলাপ আৰু যত্ন স্থিতি।',
      'caregiver.no_patients': 'এতিয়াও কোনো ৰোগী নিযুক্ত হোৱা নাই।',
      'caregiver.contact': 'যোগাযোগ',
      'caregiver.view': 'চাওক',

      'call.title': 'কল আৰম্ভ কৰক',
      'call.select_mode': 'কল মোড বাছক:',
      'call.voice': '🎙️ কণ্ঠ কল',
      'call.video': '📹 ভিডিঅ কল',
      'call.cancel': 'বাতিল কৰক',
      'call.end': 'কল শেষ কৰক',
      'call.mute': 'মিউট',
      'call.unmute': 'আনমিউট',
      'call.connecting': 'সংযোগ হৈছে…',
      'call.connected': 'সংযুক্ত',
      'call.ended': 'কল শেষ',

      // Dedicated Calls View
      'calls.title': 'কলসমূহ',
      'calls.subtitle': 'লাইভ কণ্ঠ আৰু ভিডিঅ কলৰ জৰিয়তে আপোনাৰ যত্ন দলৰ সৈতে সংযোগ কৰক।',
      'calls.search_placeholder': 'যোগাযোগ বা কল ইতিহাস বিচাৰক...',
      'calls.filter_all': 'সকলো',
      'calls.filter_missed': 'মিছড কল',
      'calls.filter_incoming': 'অহা কল',
      'calls.filter_outgoing': 'যোৱা কল',
      'calls.filter_video': 'ভিডিঅ',
      'calls.filter_voice': 'কণ্ঠ',
      'calls.contacts': 'উপলব্ধ যোগাযোগ',
      'calls.recent': 'কল ইতিহাস আৰু মিছড কল',
      'calls.no_calls': 'এতিয়ালৈকে কোনো কল ইতিহাস ৰেকৰ্ড হোৱা নাই।',
      'calls.no_calls_desc': 'লাইভ কণ্ঠ বা ভিডিঅ কল আৰম্ভ কৰিবলৈ ওপৰৰ যোগাযোগ অংশটো ব্যৱহাৰ কৰক।',

      'auth.login': 'লগ ইন',
      'auth.register': 'পঞ্জীকৰণ',
      'auth.username': 'ব্যৱহাৰকাৰী নাম',
      'auth.password': 'পাছৱৰ্ড',
      'auth.name': 'সম্পূৰ্ণ নাম',
      'auth.role': 'ভূমিকা',
      'auth.role_doctor': 'চিকিৎসক',
      'auth.role_caregiver': 'যত্নশীল',
      'auth.role_patient': 'ৰোগী',
      'auth.have_account': 'ইতিমধ্যে একাউণ্ট আছে?',
      'auth.no_account': 'একাউণ্ট নাই?',

      'lang.select': 'ভাষা',
      'lang.en': 'English',
      'lang.hi': 'हिन्दी (Hindi)',
      'lang.as': 'অসমীয়া (Assamese)',
      'lang.bn': 'বাংলা (Bengali)',
    },

    // ─── BENGALI (bn) ────────────────────────────────────────────────────────
    bn: {
      'app.title': 'কগনিটিভ কেয়ার প্ল্যাটফর্ম',
      'app.version': 'v1.0.0 · ১২ কাজ + ১২ প্রশ্নাবলী + ৫ প্রোটোকল',

      'nav.dashboard': 'ড্যাশবোর্ড',
      'nav.patients': 'রোগী',
      'nav.assessments': 'মূল্যায়ন',
      'nav.reports': 'প্রতিবেদন',
      'nav.assistant': 'AI সহায়ক',
      'nav.messages': 'বার্তা',
      'nav.caregiver_hub': 'রোগী কেন্দ্র',
      'nav.calls': 'কলসমূহ',
      'nav.logout': 'লগ আউট',

      'dashboard.title': 'ড্যাশবোর্ড',
      'dashboard.description': 'রোগীর বিশ্লেষণ এবং মূল্যায়নের সংক্ষিপ্তসার।',
      'dashboard.system_status': 'সিস্টেম অবস্থা',
      'dashboard.loading': 'লোড হচ্ছে…',

      'patient.welcome': 'স্বাগতম',
      'patient.welcome_morning': 'শুভ সকাল',
      'patient.welcome_afternoon': 'শুভ দুপুর',
      'patient.welcome_evening': 'শুভ সন্ধ্যা',
      'patient.subtitle': 'আপনার দৈনিক জ্ঞানীয় যত্ন ড্যাশবোর্ড। নিচে একটি কার্যক্রম বেছে নিন:',

      'action.take_assessment': 'মূল্যায়ন করুন',
      'action.take_assessment_desc': 'দৈনিক জ্ঞানীয় ব্যায়াম শুরু করুন',
      'action.talk_caregiver': 'পরিচর্যাকারীর সাথে কথা বলুন',
      'action.talk_caregiver_desc': 'যত্ন দলকে বার্তা পাঠান',
      'action.call_doctor': 'ডাক্তারকে কল করুন',
      'action.call_doctor_desc': 'আপনার ডাক্তারকে ভয়েস বা ভিডিও কল করুন',
      'action.call_caregiver': 'পরিচর্যাকারীকে কল করুন',
      'action.call_caregiver_desc': 'ভয়েস বা ভিডিও কল করুন',
      'doctor.section_title': 'আমার ডাক্তার',
      'doctor.call_btn': 'ডাক্তারকে কল করুন',
      'doctor.no_doctor': 'এখনো কোনো ডাক্তার নির্ধারিত হয়নি।',
      'action.ai_assistant': 'AI সহায়ক',
      'action.ai_assistant_desc': 'সাহায্য ও পরামর্শ পান',
      'action.my_progress': 'আমার অগ্রগতি',
      'action.my_progress_desc': 'স্কোর এবং প্রবণতা দেখুন',
      'action.help_support': 'সহায়তা',
      'action.help_support_desc': 'প্ল্যাটফর্ম নির্দেশনা ও সহায়তা',

      'routine.title': 'আজকের রুটিন',
      'routine.subtitle': 'আপনার ব্যক্তিগত দৈনিক জ্ঞানীয় পরিকল্পনা',
      'routine.progress_label': 'আজ সম্পন্ন',
      'routine.empty': 'আপনার অগ্রগতি দেখতে কার্যক্রম সম্পন্ন করুন।',
      'routine.start': 'শুরু করুন',
      'routine.done': 'সম্পন্ন ✓',
      'routine.morning_checkin': 'সকালের চেক-ইন',
      'routine.morning_checkin_desc': 'আপনার স্মৃতি উষ্ণ করুন',
      'routine.memory': 'স্মৃতি',
      'routine.memory_desc': 'সহযোগী স্মৃতি অনুশীলন',
      'routine.focus': 'মনোযোগ',
      'routine.focus_desc': 'মনোযোগ এবং একাগ্রতা তীক্ষ্ণ করুন',
      'routine.thinking': 'চিন্তাভাবনা',
      'routine.thinking_desc': 'যৌক্তিক ও স্থানিক যুক্তি',
      'routine.break': 'মাইন্ডফুল বিরতি',
      'routine.break_desc': 'বিশ্রাম নিন এবং শ্বাস নিন',
      'routine.communication': 'যোগাযোগ',
      'routine.communication_desc': 'শব্দ এবং ভাষার কাজ',
      'routine.evening_checkin': 'সন্ধ্যার চেক-ইন',
      'routine.evening_checkin_desc': 'পর্যালোচনা করুন এবং বিশ্রাম নিন',

      'progress.title': '🧠 স্মৃতি ও জ্ঞান অগ্রগতি',
      'progress.no_data': 'এখনো কোনো মূল্যায়ন ডেটা নেই। আপনার স্কোর দেখতে মূল্যায়ন শুরু করুন।',
      'progress.sessions_label': 'সাম্প্রতিক সেশন (গত ৪ সপ্তাহ)',
      'progress.session_count': '{n} সেশন',

      'assessments.title': 'মূল্যায়ন',
      'assessments.description': 'জ্ঞানীয় কাজ এবং প্রশ্নাবলী চালান।',

      'task.spatial_span': 'স্থানিক বিস্তার',
      'task.token_search': 'টোকেন অনুসন্ধান',
      'task.number_ladder': 'সংখ্যা মই',
      'task.paired_associates': 'যুক্ত সহযোগী',
      'task.rotations': 'ঘূর্ণন',
      'task.polygons': 'বহুভুজ',
      'task.odd_one_out': 'অদ্ভুত একটি বের করুন',
      'task.spatial_planning': 'স্থানিক পরিকল্পনা',
      'task.feature_match': 'বৈশিষ্ট্য মেলানো',
      'task.double_trouble': 'দ্বৈত সমস্যা',
      'task.grammatical_reasoning': 'ব্যাকরণগত যুক্তি',
      'task.digit_span': 'অঙ্ক বিস্তার',

      'task.spatial_span.desc': 'স্থানিক অবস্থানের ক্রম মনে রাখুন এবং পুনরুত্পাদন করুন',
      'task.token_search.desc': 'অবস্থান পুনরায় পরিদর্শন না করে গ্রিডে টোকেন খুঁজুন',
      'task.number_ladder.desc': 'সংখ্যা মইয়ে উপরে বা নিচে ধাপ গণনা করুন',
      'task.paired_associates.desc': 'বস্তু এবং অবস্থানের জুটি শিখুন এবং স্মরণ করুন',
      'task.rotations.desc': 'মিলে যাওয়া জুটি খুঁজতে 3D আকৃতি মানসিকভাবে ঘোরান',
      'task.polygons.desc': 'জ্যামিতিক বহুভুজ আকৃতি চিহ্নিত করুন এবং মেলান',
      'task.odd_one_out.desc': 'যে আইটেম দলের নিয়মে খাপ খায় না তা খুঁজুন',
      'task.spatial_planning.desc': 'গ্রিডের মাধ্যমে সবচেয়ে দক্ষ পথ পরিকল্পনা করুন',
      'task.feature_match.desc': 'লক্ষ্য বৈশিষ্ট্য ভাগ করা বস্তুগুলি দ্রুত মেলান',
      'task.double_trouble.desc': 'শব্দ উপেক্ষা করে কালির রং বলুন',
      'task.grammatical_reasoning.desc': 'বাক্যগুলি ছবির সঠিক বর্ণনা করে কিনা যাচাই করুন',
      'task.digit_span.desc': 'সামনে বা উল্টো ক্রমে অঙ্কের ক্রম স্মরণ করুন',

      'domain.STM': 'স্বল্পমেয়াদী স্মৃতি',
      'domain.Reasoning': 'যুক্তি',
      'domain.Verbal': 'মৌখিক',
      'domain.Concentration': 'একাগ্রতা',

      'reports.title': 'প্রতিবেদন',
      'reports.description': 'ভিজ্যুয়ালাইজেশন সহ ক্লিনিকাল মূল্যায়ন রিপোর্ট তৈরি করুন।',

      'assistant.title': 'AI সহায়ক',
      'assistant.description': 'সহায়কের সাথে কথা বলুন বা টাইপ করুন।',
      'assistant.placeholder': 'বার্তা টাইপ করুন বা মাইক চাপুন…',
      'assistant.send': 'পাঠান',
      'assistant.build_routine': 'আমার রুটিন তৈরি করুন',
      'assistant.how_doing': 'আমি কেমন করছি?',
      'assistant.today_practice': 'আজকের অনুশীলন',
      'assistant.patient_snapshot': 'রোগীর সারসংক্ষেপ',
      'assistant.select_patient': 'তাদের আমদানি করা স্কোর এবং ইতিহাস লোড করতে একজন রোগী বেছে নিন।',

      'messages.title': 'বার্তা',
      'messages.description': 'আপনার যত্ন দলকে বার্তা দিন।',
      'messages.placeholder': 'বার্তা টাইপ করুন…',
      'messages.send': 'পাঠান',
      'messages.select_patient': 'তাদের বার্তা সুতো দেখতে উপরে রোগী বেছে নিন।',

      'caregiver.hub_title': 'রোগী পর্যবেক্ষণ কেন্দ্র',
      'caregiver.hub_description': 'আপনার নির্ধারিত রোগীরা — সাম্প্রতিক কার্যকলাপ এবং যত্নের অবস্থা।',
      'caregiver.no_patients': 'এখনো কোনো রোগী নির্ধারিত হয়নি।',
      'caregiver.contact': 'যোগাযোগ',
      'caregiver.view': 'দেখুন',

      'call.title': 'কল শুরু করুন',
      'call.select_mode': 'কল মোড বেছে নিন:',
      'call.voice': '🎙️ ভয়েস কল',
      'call.video': '📹 ভিডিও কল',
      'call.cancel': 'বাতিল করুন',
      'call.end': 'কল শেষ করুন',
      'call.mute': 'মিউট',
      'call.unmute': 'আনমিউট',
      'call.connecting': 'সংযোগ হচ্ছে…',
      'call.connected': 'সংযুক্ত',
      'call.ended': 'কল শেষ',

      // Dedicated Calls View
      'calls.title': 'কলসমূহ',
      'calls.subtitle': 'লাইভ ভয়েস এবং ভিডিও কলের মাধ্যমে আপনার যত্ন দলের সাথে সংযোগ করুন।',
      'calls.search_placeholder': 'যোগাযোগ বা কল ইতিহাস খুঁজুন...',
      'calls.filter_all': 'সব',
      'calls.filter_missed': 'মিসড কল',
      'calls.filter_incoming': 'ইনকামিং',
      'calls.filter_outgoing': 'আউটগোয়িং',
      'calls.filter_video': 'ভিডিও',
      'calls.filter_voice': 'ভয়েস',
      'calls.contacts': 'উপলব্ধ যোগাযোগ',
      'calls.recent': 'কল ইতিহাস এবং মিসড কল',
      'calls.no_calls': 'এখনো কোনো কল ইতিহাস রেকর্ড করা হয়নি।',
      'calls.no_calls_desc': 'লাইভ ভয়েস বা ভিডিও কল শুরু করতে উপরে যোগাযোগ বিভাগ ব্যবহার করুন।',

      'auth.login': 'লগ ইন',
      'auth.register': 'নিবন্ধন',
      'auth.username': 'ব্যবহারকারী নাম',
      'auth.password': 'পাসওয়ার্ড',
      'auth.name': 'পুরো নাম',
      'auth.role': 'ভূমিকা',
      'auth.role_doctor': 'ডাক্তার',
      'auth.role_caregiver': 'পরিচর্যাকারী',
      'auth.role_patient': 'রোগী',
      'auth.have_account': 'ইতিমধ্যে অ্যাকাউন্ট আছে?',
      'auth.no_account': 'অ্যাকাউন্ট নেই?',

      'lang.select': 'ভাষা',
      'lang.en': 'English',
      'lang.hi': 'हिन्दी (Hindi)',
      'lang.as': 'অসমীয়া (Assamese)',
      'lang.bn': 'বাংলা (Bengali)',
    },
  };

  // ─── State ─────────────────────────────────────────────────────────────────
  let _currentLang = 'en';
  const STORAGE_KEY = 'ccpLang';
  const SUPPORTED = ['en', 'hi', 'as', 'bn'];

  // ─── Core API ──────────────────────────────────────────────────────────────
  function t(key, vars) {
    const dict = TRANSLATIONS[_currentLang] || TRANSLATIONS.en;
    let str = dict[key] || TRANSLATIONS.en[key] || key;
    if (vars) {
      Object.keys(vars).forEach(k => {
        str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), vars[k]);
      });
    }
    return str;
  }

  function currentLang() { return _currentLang; }

  function setLanguage(lang) {
    if (!SUPPORTED.includes(lang)) lang = 'en';
    _currentLang = lang;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
    applyAll();
    _updateSelector();
    // Notify other components that language changed
    document.dispatchEvent(new CustomEvent('i18n:change', { detail: { lang } }));
  }

  /**
   * Apply translations to all elements with data-i18n attribute.
   * Supports: data-i18n="key"          → element.textContent
   *           data-i18n-placeholder="key" → element.placeholder
   *           data-i18n-title="key"    → element.title
   *           data-i18n-aria="key"     → element.ariaLabel
   */
  function applyAll() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      if (key) el.textContent = t(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.dataset.i18nPlaceholder;
      if (key) el.placeholder = t(key);
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.dataset.i18nTitle;
      if (key) el.title = t(key);
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
      const key = el.dataset.i18nAria;
      if (key) el.setAttribute('aria-label', t(key));
    });
  }

  function _updateSelector() {
    if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return;
    const sel = document.getElementById('app-lang-select');
    if (sel) sel.value = _currentLang;
  }

  function init() {
    // Load persisted language
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && SUPPORTED.includes(saved)) _currentLang = saved;
    } catch (e) {}
    applyAll();
    _updateSelector();
  }

  return { t, currentLang, setLanguage, applyAll, init, SUPPORTED };
})();

// Expose globally
if (typeof window !== 'undefined') {
  window.I18n = I18n;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = I18n;
}
