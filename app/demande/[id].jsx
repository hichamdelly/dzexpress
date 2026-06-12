import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Platform, StatusBar, ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { demandesDB, offresDB, notifDB, usersDB, annulationsDB, messagesDB } from '../../src/db/database';
import { fmtPrix, calculerPrix } from '../../src/utils/pricing';
import { useApp, localNotif } from '../../src/context/AppContext';
import { getDistanceKm, fmtKm } from '../../src/utils/wilayas';

const C = {
  primary: '#0A0A0A', accent: '#F97316', accentLight: '#FFF3E8',
  bg: '#FFFFFF', bgAlt: '#F5F5F5', text: '#0A0A0A',
  muted: '#6B7280', border: '#E5E7EB',
  success: '#10B981', successLight: '#ECFDF5',
  error: '#EF4444', errorLight: '#FEF2F2',
  warning: '#F59E0B', warningLight: '#FFFBEB',
};

const STATUTS = {
  en_attente: { label: 'En attente',  color: C.warning, bg: C.warningLight, icon: 'time-outline',            desc: 'Ta demande est visible par tous les transporteurs.' },
  acceptee:   { label: 'Acceptée',    color: '#1A56DB', bg: '#EBF5FF',      icon: 'checkmark-circle-outline', desc: 'Un transporteur a accepté ta demande. Contacte-le !' },
  en_cours:   { label: 'En cours',    color: C.accent,  bg: C.accentLight,  icon: 'car-sport-outline',        desc: 'Ton colis est en route vers la destination.' },
  livree:     { label: 'Livrée',      color: C.success, bg: C.successLight, icon: 'cube-outline',             desc: 'Ta marchandise a été livrée.' },
  annulee:    { label: 'Annulée',     color: C.error,   bg: C.errorLight,   icon: 'close-circle-outline',     desc: 'Cette demande a été annulée.' },
};

const TYPES_ICON = {
  meubles: 'grid-outline', electromenager: 'tv-outline', cartons: 'cube-outline',
  materiaux: 'construct-outline', vehicule: 'car-outline', autre: 'ellipsis-horizontal-circle-outline',
};

const VEH_ICON = {
  fourgon: 'car-sport-outline', camion35: 'bus-outline', camion10: 'cube-outline', semi: 'construct-outline',
};

const TIMELINE = ['en_attente', 'acceptee', 'en_cours', 'livree'];

export default function DetailDemandeScreen() {
  const { id }   = useLocalSearchParams();
  const router   = useRouter();
  const { user } = useApp();

  const [demande, setDemande]             = useState(null);
  const [offres, setOffres]               = useState([]);
  const [loading, setLoading]             = useState(true);
  const [accepting, setAccepting]         = useState(null);
  const [offresAnnulations, setOffresAnn] = useState({});
  const [transAnnulations, setTransAnn]   = useState(0);
  const [showPrixDetail, setShowPrixDetail] = useState(false);
  const [contreForm, setContreForm]       = useState(null);
  const [contrePrix, setContrePrix]       = useState('');
  const [msgUnread, setMsgUnread]         = useState(0);
  const [timeLeft, setTimeLeft]           = useState(null);
  const timerRef                          = useRef(null);

  const fetch = useCallback(() => {
    try {
      const d = demandesDB.getById(parseInt(id));
      setDemande(d);
      if (d?.transporteur_id) {
        setTransAnn(usersDB.getAnnulations(d.transporteur_id));
        setMsgUnread(messagesDB.countUnreadForDemande(parseInt(id), user?.id || 0));
      } else {
        setTransAnn(0); setMsgUnread(0);
      }
      if (d?.type_demande === 'planifie') {
        const offs = offresDB.getByDemande(parseInt(id));
        setOffres(offs);
        const annulMap = {};
        for (const o of offs) annulMap[o.transporteur_id] = usersDB.getAnnulations(o.transporteur_id);
        setOffresAnn(annulMap);
      }
    } catch (e) { console.log(e.message); }
    finally { setLoading(false); }
  }, [id]);

  useFocusEffect(useCallback(() => { fetch(); }, [fetch]));

  useEffect(() => {
    clearInterval(timerRef.current);
    if (!demande || demande.statut !== 'acceptee' || !demande.accepted_at) { setTimeLeft(null); return; }
    const GRACE = 5 * 60;
    const acceptedMs = new Date(demande.accepted_at.replace(' ', 'T') + 'Z').getTime();
    const tick = () => setTimeLeft(Math.max(0, Math.floor(GRACE - (Date.now() - acceptedMs) / 1000)));
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
  }, [demande?.accepted_at, demande?.statut]);

  const annuler = () => {
    const isGratuite = demande.statut === 'acceptee' && timeLeft !== null && timeLeft > 0;
    Alert.alert('Annuler la demande ?',
      demande.statut === 'acceptee'
        ? isGratuite ? 'Annulation gratuite — le transporteur sera notifié.'
          : 'Le délai gratuit est dépassé. Le transporteur sera notifié.'
        : 'Elle ne sera plus visible par les transporteurs.',
      [
        { text: 'Non', style: 'cancel' },
        { text: 'Annuler', style: 'destructive', onPress: () => {
          demandesDB.updateStatut(parseInt(id), 'annulee');
          annulationsDB.create({ demande_id: parseInt(id), user_id: user.id, role: 'expediteur', motif: null, gratuite: isGratuite ? 1 : 0 });
          if (demande.transporteur_id)
            notifDB.create(demande.transporteur_id, `L'expéditeur a annulé la demande ${demande.ville_depart} → ${demande.ville_arrivee}.`);
          fetch();
        }},
      ]
    );
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={C.primary} /></View>;

  if (!demande) return (
    <View style={s.center}>
      <Text style={s.emptyTitle}>Demande introuvable</Text>
      <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 14 }}>
        <Text style={{ color: C.accent, fontWeight: '700' }}>Retour</Text>
      </TouchableOpacity>
    </View>
  );

  const st         = STATUTS[demande.statut] || STATUTS.en_attente;
  const currentIdx = TIMELINE.indexOf(demande.statut);

  return (
    <View style={{ flex: 1, backgroundColor: C.bgAlt }}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />

      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={s.headerTitle}>Détail de la demande</Text>
          <Text style={s.headerId}>#DZ{String(demande.id).padStart(4, '0')}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>

        {/* Statut */}
        <View style={[s.statusCard, { borderColor: st.color, backgroundColor: st.bg }]}>
          <View style={[s.statusIconBox, { backgroundColor: st.color }]}>
            <Ionicons name={st.icon} size={24} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={[s.statusTitle, { color: st.color }]}>{st.label}</Text>
            <Text style={s.statusDesc}>{st.desc}</Text>
          </View>
        </View>

        {/* Timeline */}
        {demande.statut !== 'annulee' && (
          <View style={s.card}>
            <SectionTitle icon="bar-chart-outline">Suivi de la livraison</SectionTitle>
            <View style={s.timeline}>
              {TIMELINE.map((step, i) => {
                const done    = i <= currentIdx;
                const current = i === currentIdx;
                const stepSt  = STATUTS[step];
                return (
                  <View key={step} style={s.timelineRow}>
                    <View style={s.timelineLeft}>
                      <View style={[s.timelineDot, { backgroundColor: done ? (current ? stepSt.color : C.success) : C.border }]}>
                        {done && <Ionicons name={current ? stepSt.icon : 'checkmark'} size={12} color="#FFFFFF" />}
                      </View>
                      {i < TIMELINE.length - 1 && (
                        <View style={[s.timelineLine, i < currentIdx && { backgroundColor: C.success }]} />
                      )}
                    </View>
                    <View style={s.timelineRight}>
                      <Text style={[s.timelineLabel, !done && { color: C.muted }]}>{stepSt.label}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Prix estimé */}
        {demande.prix_estime > 0 && (() => {
          const opts = (() => { try { return JSON.parse(demande.options_supplementaires || '{}'); } catch { return {}; } })();
          const km   = getDistanceKm(demande.ville_depart, demande.ville_arrivee) || 50;
          const px   = calculerPrix(km, 'fourgon', { ...opts, nbActives: 0 });
          return (
            <View style={ps.box}>
              <View style={ps.headerRow}>
                <Ionicons name="wallet-outline" size={14} color={C.success} style={{ marginRight: 6 }} />
                <Text style={ps.title}>Prix estimé</Text>
                {demande.prix_final > 0 && (
                  <View style={ps.finalBadge}><Text style={ps.finalTxt}>Prix final confirmé</Text></View>
                )}
              </View>
              <Text style={ps.range}>
                {fmtPrix(demande.prix_estime)} – {fmtPrix(Math.round(demande.prix_estime * 1.15 / 25) * 25)}
              </Text>
              {demande.prix_final > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                  <Ionicons name="checkmark-circle" size={14} color={C.success} style={{ marginRight: 5 }} />
                  <Text style={ps.final}>Prix final : {fmtPrix(demande.prix_final)}</Text>
                </View>
              )}
              {demande.surge_coefficient > 1 && (
                <View style={ps.surgeChip}>
                  <Ionicons name="flash" size={12} color={C.accent} style={{ marginRight: 4 }} />
                  <Text style={ps.surgeTxt}>Surge actif ×{demande.surge_coefficient.toFixed(2)}</Text>
                </View>
              )}
              <TouchableOpacity style={ps.detailBtn} onPress={() => setShowPrixDetail(v => !v)}>
                <Ionicons name={showPrixDetail ? 'chevron-up' : 'chevron-down'} size={12} color={C.success} style={{ marginRight: 4 }} />
                <Text style={ps.detailBtnTxt}>Voir le détail du calcul</Text>
              </TouchableOpacity>
              {showPrixDetail && (
                <View style={ps.detail}>
                  <Text style={ps.dLine}>{px.detail.km} km × {px.detail.tarifKm} DA/km (fourgon)</Text>
                  <Text style={ps.dLine}>Prise en charge : {fmtPrix(px.detail.priseEnCharge)}</Text>
                  <Text style={ps.dLine}>Base : {fmtPrix(px.detail.baseAvantSurge)}</Text>
                  {demande.surge_coefficient > 1 && (
                    <Text style={[ps.dLine, { color: C.accent }]}>Surge ×{demande.surge_coefficient.toFixed(2)}</Text>
                  )}
                  {opts.etages > 0 && <Text style={ps.dLine}>{opts.etages} étage(s) : +{fmtPrix(opts.etages * 200)}</Text>}
                  {opts.aide    && <Text style={ps.dLine}>Aide chargement : +500 DA</Text>}
                  {opts.fragile && <Text style={ps.dLine}>Fragile : +20%</Text>}
                  {opts.express && <Text style={ps.dLine}>Express : +40%</Text>}
                </View>
              )}
            </View>
          );
        })()}

        {/* Marchandise */}
        <View style={s.card}>
          <SectionTitle icon={TYPES_ICON[demande.type_marchandise] || 'cube-outline'}>Marchandise</SectionTitle>
          <InfoRow iconName={TYPES_ICON[demande.type_marchandise] || 'cube-outline'} label="Type" value={demande.type_marchandise} />
          {demande.poids && <InfoRow iconName="scale-outline" label="Poids" value={demande.poids} />}
          {demande.description && <InfoRow iconName="document-text-outline" label="Description" value={demande.description} />}
        </View>

        {/* Itinéraire */}
        <View style={s.card}>
          <SectionTitle icon="navigate-outline">Itinéraire</SectionTitle>
          <View style={s.routeBlock}>
            <View style={s.routePoint}>
              <View style={[s.routeDot, { backgroundColor: C.success }]} />
              <View style={{ marginLeft: 14 }}>
                <Text style={s.routePointLabel}>Départ</Text>
                <Text style={s.routeCity}>{demande.ville_depart}</Text>
              </View>
            </View>
            <View style={s.routeVertLine} />
            <View style={s.routePoint}>
              <View style={[s.routeDot, { backgroundColor: C.error }]} />
              <View style={{ marginLeft: 14 }}>
                <Text style={s.routePointLabel}>Arrivée</Text>
                <Text style={s.routeCity}>{demande.ville_arrivee}</Text>
              </View>
            </View>
          </View>
          <InfoRow iconName="calendar-outline" label="Date souhaitée" value={demande.date_souhaitee} />
          {(() => {
            const km = getDistanceKm(demande.ville_depart, demande.ville_arrivee);
            return km ? <InfoRow iconName="resize-outline" label="Distance estimée" value={`${fmtKm(km)} (vol d'oiseau ×1.25)`} /> : null;
          })()}
        </View>

        {/* Bouton contact transporteur */}
        {['acceptee', 'en_cours', 'livree'].includes(demande.statut) && (
          <TouchableOpacity style={cs.contactBtn} onPress={() => router.push(`/chat/${demande.id}`)}>
            <Ionicons name="chatbubble-ellipses" size={18} color={C.success} style={{ marginRight: 8 }} />
            <Text style={cs.contactBtnTxt}>
              Contacter le transporteur{msgUnread > 0 ? ` · ${msgUnread} non lu${msgUnread > 1 ? 's' : ''}` : ''}
            </Text>
            {msgUnread > 0 && (
              <View style={cs.badge}><Text style={cs.badgeTxt}>{msgUnread > 9 ? '9+' : msgUnread}</Text></View>
            )}
          </TouchableOpacity>
        )}

        {/* Transporteur assigné */}
        {demande.transporteur_nom && (
          <View style={[s.card, { borderColor: C.success, borderWidth: 1.5 }]}>
            <SectionTitle icon="car-sport-outline">Transporteur assigné</SectionTitle>
            <View style={s.transporteurBlock}>
              <View style={s.transporteurAvatar}>
                <Text style={s.transporteurAvatarTxt}>
                  {demande.transporteur_nom?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.transporteurName}>{demande.transporteur_nom}</Text>
                {demande.transporteur_vehicule && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                    <Ionicons name={VEH_ICON[demande.transporteur_vehicule] || 'car-sport-outline'} size={13} color={C.muted} style={{ marginRight: 4 }} />
                    <Text style={s.transporteurVeh}>{demande.transporteur_vehicule}</Text>
                  </View>
                )}
                <AnnulationsBadge count={transAnnulations} />
              </View>
            </View>
            {demande.transporteur_tel && (
              <TouchableOpacity style={s.callBtn}
                onPress={() => Alert.alert('Appel', `Numéro : ${demande.transporteur_tel}`)}>
                <Ionicons name="call-outline" size={16} color={C.success} style={{ marginRight: 8 }} />
                <Text style={s.callBtnTxt}>{demande.transporteur_tel}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Offres (mode planifié) */}
        {demande.type_demande === 'planifie' && demande.statut === 'en_attente' && (
          <View style={s.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
              <Ionicons name="chatbubble-outline" size={16} color={C.text} style={{ marginRight: 8 }} />
              <Text style={s.cardTitle}>Offres des transporteurs</Text>
              {offres.length > 0 && (
                <View style={s.countBadge}><Text style={s.countBadgeTxt}>{offres.length}</Text></View>
              )}
            </View>

            {offres.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                <View style={s.emptyOffreIcon}><Ionicons name="time-outline" size={28} color="#D1D5DB" /></View>
                <Text style={{ fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 20 }}>
                  En attente des offres des transporteurs…{'\n'}Reviens dans quelques minutes.
                </Text>
              </View>
            ) : (
              offres.map((offre, i) => (
                <View key={offre.id} style={[offreStyles.card,
                  offre.statut === 'acceptee' && offreStyles.cardAccepted,
                  i > 0 && { marginTop: 10 },
                ]}>
                  <View style={offreStyles.header}>
                    <View style={offreStyles.avatar}>
                      <Text style={offreStyles.avatarTxt}>
                        {offre.transporteur_nom?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={offreStyles.nom}>{offre.transporteur_nom}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                        <Ionicons name="car-sport-outline" size={12} color={C.muted} style={{ marginRight: 3 }} />
                        <Text style={offreStyles.veh}>{offre.transporteur_vehicule} · {offre.transporteur_wilaya}</Text>
                      </View>
                      <AnnulationsBadge count={offresAnnulations[offre.transporteur_id] ?? 0} />
                    </View>
                    {offre.statut === 'acceptee' && (
                      <View style={offreStyles.acceptedBadge}>
                        <Ionicons name="checkmark" size={11} color={C.success} style={{ marginRight: 3 }} />
                        <Text style={offreStyles.acceptedTxt}>Acceptée</Text>
                      </View>
                    )}
                  </View>

                  {offre.prix_propose ? (
                    <Text style={offreStyles.prix}>{offre.prix_propose.toLocaleString()} DA</Text>
                  ) : (
                    <Text style={[offreStyles.prix, { color: C.muted }]}>Prix à négocier</Text>
                  )}
                  {offre.message ? <Text style={offreStyles.message}>"{offre.message}"</Text> : null}

                  {offre.contre_prix > 0 && offre.dernier_negociateur === 'expediteur' && (
                    <View style={offreStyles.contreBadge}>
                      <Ionicons name="chatbubble-outline" size={12} color={C.accent} style={{ marginRight: 5 }} />
                      <Text style={offreStyles.contreTxt}>
                        Ta contre-proposition : {fmtPrix(offre.contre_prix)}{'\n'}En attente de réponse…
                      </Text>
                    </View>
                  )}
                  {offre.contre_prix > 0 && offre.dernier_negociateur === 'transporteur' && (
                    <View style={[offreStyles.contreBadge, { backgroundColor: '#EBF5FF', borderColor: '#BFDBFE' }]}>
                      <Ionicons name="swap-horizontal-outline" size={12} color="#1A56DB" style={{ marginRight: 5 }} />
                      <Text style={[offreStyles.contreTxt, { color: '#1A56DB' }]}>
                        Contre-offre du transporteur : {fmtPrix(offre.contre_prix)}
                      </Text>
                    </View>
                  )}

                  {demande.statut === 'en_attente' && offre.statut === 'en_attente' && (
                    <>
                      <TouchableOpacity
                        style={[offreStyles.acceptBtn, accepting === offre.id && { opacity: 0.7 }]}
                        disabled={accepting === offre.id}
                        onPress={() => {
                          const prixDisplay = offre.contre_prix ? fmtPrix(offre.contre_prix) : offre.prix_propose ? fmtPrix(offre.prix_propose) : 'Prix à négocier';
                          Alert.alert('Accepter cette offre ?', `${offre.transporteur_nom} — ${prixDisplay}`, [
                            { text: 'Non', style: 'cancel' },
                            { text: 'Accepter', onPress: async () => {
                              setAccepting(offre.id);
                              try {
                                const prixFinal = offre.contre_prix || offre.prix_propose || null;
                                offresDB.accepter(offre.id, demande.id, offre.transporteur_id);
                                if (prixFinal) demandesDB.setPrixFinal(demande.id, prixFinal);
                                notifDB.create(offre.transporteur_id, `Ton offre pour ${demande.ville_depart} → ${demande.ville_arrivee} a été acceptée !`);
                                localNotif(user.id, `Tu as accepté l'offre de ${offre.transporteur_nom} !`);
                                fetch();
                              } catch (e) { Alert.alert('Erreur', e.message); }
                              finally { setAccepting(null); }
                            }},
                          ]);
                        }}
                      >
                        {accepting === offre.id
                          ? <ActivityIndicator color="#FFFFFF" size="small" />
                          : <>
                              <Ionicons name="checkmark" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                              <Text style={offreStyles.acceptBtnTxt}>Accepter cette offre</Text>
                            </>
                        }
                      </TouchableOpacity>

                      {(offre.nb_contre_propositions || 0) < 4 && offre.dernier_negociateur !== 'expediteur' && (
                        contreForm === offre.id ? (
                          <View style={offreStyles.contreForm}>
                            <TextInput
                              style={offreStyles.contreInput}
                              placeholder="Ton prix en DA…"
                              placeholderTextColor="#9CA3AF"
                              keyboardType="numeric"
                              value={contrePrix} onChangeText={setContrePrix}
                            />
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                              <TouchableOpacity
                                style={[offreStyles.contreSendBtn, !contrePrix && { opacity: 0.5 }]}
                                disabled={!contrePrix}
                                onPress={() => {
                                  const prix = parseFloat(contrePrix);
                                  if (!prix || prix <= 0) return;
                                  offresDB.contreProposer(offre.id, prix, 'expediteur');
                                  notifDB.create(offre.transporteur_id, `${user.nom} te fait une contre-proposition : ${fmtPrix(prix)} pour ${demande.ville_depart} → ${demande.ville_arrivee}`);
                                  setContreForm(null); setContrePrix(''); fetch();
                                }}
                              >
                                <Text style={offreStyles.contreSendTxt}>Envoyer</Text>
                              </TouchableOpacity>
                              <TouchableOpacity style={offreStyles.contreAbandon} onPress={() => { setContreForm(null); setContrePrix(''); }}>
                                <Text style={{ color: C.muted, fontWeight: '600' }}>Annuler</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ) : (
                          <TouchableOpacity style={offreStyles.contreBtn} onPress={() => { setContreForm(offre.id); setContrePrix(''); }}>
                            <Ionicons name="swap-horizontal-outline" size={14} color={C.accent} style={{ marginRight: 6 }} />
                            <Text style={offreStyles.contreBtnTxt}>
                              Contre-proposer
                              {offre.nb_contre_propositions > 0 ? ` (${2 - Math.ceil(offre.nb_contre_propositions / 2)} restante${2 - Math.ceil(offre.nb_contre_propositions / 2) > 1 ? 's' : ''})` : ''}
                            </Text>
                          </TouchableOpacity>
                        )
                      )}
                    </>
                  )}
                </View>
              ))
            )}
          </View>
        )}

        {/* Transporteur simulé (mode maintenant) */}
        {demande.type_demande === 'maintenant' && demande.transporteur_simule && (() => {
          try {
            const t = JSON.parse(demande.transporteur_simule);
            return (
              <View style={[s.card, { borderColor: C.success, borderWidth: 1.5 }]}>
                <SectionTitle icon="car-sport-outline">Transporteur (mode Maintenant)</SectionTitle>
                <Text style={{ fontSize: 16, fontWeight: '800', color: C.text, marginBottom: 4 }}>{t.nom}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <Ionicons name="star" size={13} color="#F59E0B" style={{ marginRight: 4 }} />
                  <Text style={{ color: C.muted }}>{t.rating} · {t.vehicule_label}</Text>
                </View>
                <View style={s.callBtn}>
                  <Ionicons name="call-outline" size={16} color={C.success} style={{ marginRight: 8 }} />
                  <Text style={s.callBtnTxt}>{t.telephone}</Text>
                </View>
              </View>
            );
          } catch { return null; }
        })()}

        {/* Timer annulation gratuite */}
        {demande.statut === 'acceptee' && timeLeft !== null && (
          <View style={[s.timerBanner, timeLeft > 0 ? { backgroundColor: C.warningLight, borderColor: '#FCD34D' } : { backgroundColor: C.errorLight, borderColor: '#FCA5A5' }]}>
            <Ionicons name={timeLeft > 0 ? 'timer-outline' : 'warning-outline'} size={16} color={timeLeft > 0 ? C.warning : C.error} style={{ marginRight: 8 }} />
            {timeLeft > 0 ? (
              <Text style={[s.timerTxt, { color: C.warning }]}>
                Annulation gratuite : {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
              </Text>
            ) : (
              <Text style={[s.timerTxt, { color: C.error }]}>Délai d'annulation gratuite dépassé</Text>
            )}
          </View>
        )}

        {/* Bouton annuler */}
        {['en_attente', 'acceptee'].includes(demande.statut) && (
          <TouchableOpacity style={s.cancelBtn} onPress={annuler}>
            <Ionicons name="close-circle-outline" size={18} color={C.error} style={{ marginRight: 8 }} />
            <Text style={s.cancelBtnTxt}>
              {demande.statut === 'acceptee' && timeLeft !== null && timeLeft > 0
                ? 'Annuler gratuitement'
                : 'Annuler cette demande'}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

function SectionTitle({ icon, children }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
      <Ionicons name={icon} size={16} color={C.text} style={{ marginRight: 8 }} />
      <Text style={s.cardTitle}>{children}</Text>
    </View>
  );
}

function AnnulationsBadge({ count }) {
  if (count <= 2) return null;
  const rouge = count > 5;
  return (
    <View style={[ab.badge, rouge ? { backgroundColor: C.errorLight, borderColor: '#FCA5A5' } : { backgroundColor: C.accentLight, borderColor: '#FED7AA' }]}>
      <Ionicons name="alert-circle-outline" size={11} color={rouge ? C.error : C.accent} style={{ marginRight: 3 }} />
      <Text style={[ab.txt, { color: rouge ? C.error : C.accent }]}>
        {count} annulation{count > 1 ? 's' : ''}{rouge ? ' · Peu fiable' : ''}
      </Text>
    </View>
  );
}
const ab = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', borderRadius: 50, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', marginTop: 5, borderWidth: 1 },
  txt:   { fontSize: 11, fontWeight: '700' },
});

function InfoRow({ iconName, label, value }) {
  return (
    <View style={ir.root}>
      <View style={ir.iconBox}><Ionicons name={iconName} size={16} color={C.muted} /></View>
      <View style={{ flex: 1 }}>
        <Text style={ir.label}>{label}</Text>
        <Text style={ir.value}>{value}</Text>
      </View>
    </View>
  );
}
const ir = StyleSheet.create({
  root:   { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  iconBox:{ width: 32, height: 32, borderRadius: 8, backgroundColor: C.bgAlt, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  label:  { fontSize: 11, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  value:  { fontSize: 14, fontWeight: '600', color: C.text, lineHeight: 20 },
});

const s = StyleSheet.create({
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bgAlt },
  emptyTitle:  { fontSize: 17, fontWeight: '700', color: C.text },

  header:      { backgroundColor: C.primary, paddingTop: Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight || 24) + 12, paddingBottom: 18, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' },
  backBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  headerId:    { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 },

  card:        { backgroundColor: C.bg, borderRadius: 12, padding: 18, elevation: 1, borderWidth: 1, borderColor: '#F3F4F6', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06 },
  cardTitle:   { fontSize: 15, fontWeight: '800', color: C.text, flex: 1 },

  statusCard:  { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 16, borderWidth: 1.5 },
  statusIconBox:{ width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  statusTitle: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  statusDesc:  { fontSize: 13, color: C.muted, lineHeight: 18 },

  timeline:    { gap: 0 },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  timelineLeft:{ alignItems: 'center', width: 26 },
  timelineDot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  timelineLine:{ width: 2, height: 30, backgroundColor: C.border, marginTop: 2 },
  timelineRight:{ paddingTop: 3, paddingBottom: 24 },
  timelineLabel:{ fontSize: 14, fontWeight: '700', color: C.text },

  routeBlock:    { marginBottom: 12 },
  routePoint:    { flexDirection: 'row', alignItems: 'center' },
  routeDot:      { width: 13, height: 13, borderRadius: 7 },
  routeVertLine: { width: 2, height: 22, backgroundColor: C.border, marginLeft: 5, marginVertical: 3 },
  routePointLabel:{ fontSize: 11, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.4 },
  routeCity:     { fontSize: 16, fontWeight: '800', color: C.text, letterSpacing: -0.3 },

  transporteurBlock:     { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  transporteurAvatar:    { width: 46, height: 46, borderRadius: 23, backgroundColor: C.bgAlt, alignItems: 'center', justifyContent: 'center' },
  transporteurAvatarTxt: { fontSize: 16, fontWeight: '900', color: C.muted },
  transporteurName:      { fontSize: 15, fontWeight: '800', color: C.text },
  transporteurVeh:       { fontSize: 12, color: C.muted },

  callBtn:    { flexDirection: 'row', alignItems: 'center', backgroundColor: C.successLight, borderRadius: 10, paddingVertical: 13, paddingHorizontal: 14, borderWidth: 1.5, borderColor: '#6EE7B7' },
  callBtnTxt: { fontSize: 15, fontWeight: '700', color: C.success },

  countBadge:    { backgroundColor: C.primary, borderRadius: 50, paddingHorizontal: 9, paddingVertical: 3, marginLeft: 8 },
  countBadgeTxt: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },

  emptyOffreIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: C.bgAlt, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },

  timerBanner: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, borderWidth: 1.5 },
  timerTxt:    { fontSize: 14, fontWeight: '800' },

  cancelBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.errorLight, borderRadius: 12, paddingVertical: 14, borderWidth: 1.5, borderColor: '#FCA5A5' },
  cancelBtnTxt: { fontSize: 15, fontWeight: '700', color: C.error },
});

const cs = StyleSheet.create({
  contactBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.successLight, borderRadius: 12, paddingVertical: 15, borderWidth: 1.5, borderColor: '#6EE7B7' },
  contactBtnTxt: { fontSize: 15, fontWeight: '800', color: C.success },
  badge:         { backgroundColor: C.error, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, marginLeft: 6 },
  badgeTxt:      { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
});

const offreStyles = StyleSheet.create({
  card:          { backgroundColor: C.bgAlt, borderRadius: 12, padding: 14, borderWidth: 1.5, borderColor: C.border },
  cardAccepted:  { borderColor: C.success, backgroundColor: C.successLight },
  header:        { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  avatar:        { width: 42, height: 42, borderRadius: 21, backgroundColor: C.bg, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  avatarTxt:     { fontSize: 14, fontWeight: '900', color: C.muted },
  nom:           { fontSize: 14, fontWeight: '800', color: C.text },
  veh:           { fontSize: 12, color: C.muted },
  acceptedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.successLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 50 },
  acceptedTxt:   { fontSize: 12, fontWeight: '700', color: C.success },
  prix:          { fontSize: 22, fontWeight: '900', color: C.primary, marginBottom: 6 },
  message:       { fontSize: 13, color: C.muted, fontStyle: 'italic', marginBottom: 10, lineHeight: 19 },
  acceptBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.primary, borderRadius: 50, paddingVertical: 13, marginTop: 4 },
  acceptBtnTxt:  { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  contreBadge:   { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: C.accentLight, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#FED7AA', marginBottom: 6 },
  contreTxt:     { fontSize: 12, fontWeight: '700', color: C.accent, lineHeight: 18, flex: 1 },
  contreBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.accent, borderRadius: 50, paddingVertical: 10, marginTop: 6 },
  contreBtnTxt:  { fontSize: 13, fontWeight: '700', color: C.accent },
  contreForm:    { marginTop: 8, gap: 8 },
  contreInput:   { backgroundColor: C.bg, borderWidth: 1.5, borderColor: C.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: C.text },
  contreSendBtn: { flex: 1, backgroundColor: C.accent, borderRadius: 50, paddingVertical: 10, alignItems: 'center' },
  contreSendTxt: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  contreAbandon: { paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
});

const ps = StyleSheet.create({
  box:        { backgroundColor: C.successLight, borderRadius: 12, padding: 16, borderWidth: 1.5, borderColor: '#6EE7B7' },
  headerRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  title:      { fontSize: 13, fontWeight: '800', color: C.success, flex: 1 },
  finalBadge: { backgroundColor: C.success, borderRadius: 50, paddingHorizontal: 10, paddingVertical: 3 },
  finalTxt:   { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  range:      { fontSize: 22, fontWeight: '900', color: C.primary, marginBottom: 4 },
  final:      { fontSize: 14, fontWeight: '700', color: C.success },
  surgeChip:  { flexDirection: 'row', alignItems: 'center', backgroundColor: C.accentLight, borderRadius: 8, padding: 7, borderWidth: 1, borderColor: '#FED7AA', marginBottom: 6, alignSelf: 'flex-start' },
  surgeTxt:   { fontSize: 12, fontWeight: '700', color: C.accent },
  detailBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 8 },
  detailBtnTxt: { fontSize: 12, fontWeight: '700', color: C.success },
  detail:     { backgroundColor: '#DCFCE7', borderRadius: 8, padding: 10, marginTop: 8 },
  dLine:      { fontSize: 12, color: C.muted, marginBottom: 3 },
});
