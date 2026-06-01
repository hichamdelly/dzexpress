import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Platform, StatusBar, ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { demandesDB, offresDB, notifDB, usersDB, annulationsDB, messagesDB } from '../../src/db/database';
import { fmtPrix, calculerPrix } from '../../src/utils/pricing';
import { useApp, localNotif } from '../../src/context/AppContext';
import { getDistanceKm, fmtKm, estimerPrix } from '../../src/utils/wilayas';

const C = {
  blue:        '#1A56DB',
  blueLight:   '#EBF5FF',
  orange:      '#F97316',
  orangeLight: '#FFF7ED',
  bg:          '#F8FAFC',
  white:       '#FFFFFF',
  text:        '#1E293B',
  muted:       '#64748B',
  border:      '#E2E8F0',
  green:       '#16A34A',
  greenLight:  '#F0FDF4',
  yellow:      '#D97706',
  yellowLight: '#FFFBEB',
  red:         '#DC2626',
  redLight:    '#FEF2F2',
};

const STATUTS = {
  en_attente: { label: 'En attente',  color: C.yellow, bg: C.yellowLight, icon: '⏳', desc: 'Ta demande est visible par tous les transporteurs.' },
  acceptee:   { label: 'Acceptée',    color: C.blue,   bg: C.blueLight,   icon: '✅', desc: 'Un transporteur a accepté ta demande. Contacte-le !' },
  en_cours:   { label: 'En cours',    color: C.orange, bg: C.orangeLight, icon: '🚛', desc: 'Ton colis est en route vers la destination.' },
  livree:     { label: 'Livrée',      color: C.green,  bg: C.greenLight,  icon: '📦', desc: 'Ta marchandise a été livrée. Labès !' },
  annulee:    { label: 'Annulée',     color: C.red,    bg: C.redLight,    icon: '❌', desc: 'Cette demande a été annulée.' },
};

const TYPES_ICON = {
  meubles: '🪑', electromenager: '📺', cartons: '📦',
  materiaux: '🧱', vehicule: '🚗', autre: '🔧',
};

const VEH_ICON = { fourgon: '🚐', camion35: '🚛', camion10: '🚚', semi: '🏗️' };

const TIMELINE = ['en_attente', 'acceptee', 'en_cours', 'livree'];

export default function DetailDemandeScreen() {
  const { id }   = useLocalSearchParams();
  const router   = useRouter();
  const { user } = useApp();

  const [demande, setDemande] = useState(null);
  const [offres, setOffres]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(null);
  const [transporteurAnnulations, setTransporteurAnnulations] = useState(0);
  const [offresAnnulations, setOffresAnnulations] = useState({});
  const [showPrixDetail, setShowPrixDetail]       = useState(false);
  const [contreForm, setContreForm]               = useState(null);
  const [contrePrix, setContrePrix]               = useState('');
  const [msgUnread, setMsgUnread]                 = useState(0);
  const [timeLeft, setTimeLeft]   = useState(null); // secondes restantes pour annulation gratuite
  const timerRef                  = useRef(null);

  const fetch = useCallback(() => {
    try {
      const d = demandesDB.getById(parseInt(id));
      setDemande(d);
      if (d?.transporteur_id) {
        setTransporteurAnnulations(usersDB.getAnnulations(d.transporteur_id));
        setMsgUnread(messagesDB.countUnreadForDemande(parseInt(id), user?.id || 0));
      } else {
        setTransporteurAnnulations(0);
        setMsgUnread(0);
      }
      if (d?.type_demande === 'planifie') {
        const offs = offresDB.getByDemande(parseInt(id));
        setOffres(offs);
        const annulMap = {};
        for (const o of offs) {
          annulMap[o.transporteur_id] = usersDB.getAnnulations(o.transporteur_id);
        }
        setOffresAnnulations(annulMap);
      }
    } catch (e) { console.log(e.message); }
    finally { setLoading(false); }
  }, [id]);

  useFocusEffect(useCallback(() => { fetch(); }, [fetch]));

  // ── Timer annulation gratuite (5 min après acceptation) ──
  useEffect(() => {
    clearInterval(timerRef.current);
    if (!demande || demande.statut !== 'acceptee' || !demande.accepted_at) {
      setTimeLeft(null);
      return;
    }
    const GRACE = 5 * 60; // 5 minutes en secondes
    const acceptedMs = new Date(demande.accepted_at.replace(' ', 'T') + 'Z').getTime();

    const tick = () => {
      const elapsed = (Date.now() - acceptedMs) / 1000;
      setTimeLeft(Math.max(0, Math.floor(GRACE - elapsed)));
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
  }, [demande?.accepted_at, demande?.statut]);

  const annuler = () => {
    const isGratuite = demande.statut === 'acceptee' && timeLeft !== null && timeLeft > 0;
    const sous_titre = demande.statut === 'acceptee'
      ? isGratuite
        ? 'Annulation gratuite — le transporteur sera notifié.'
        : '⚠️ Le délai gratuit est dépassé. Le transporteur sera notifié.'
      : 'Elle ne sera plus visible par les transporteurs.';

    Alert.alert('Annuler la demande ?', sous_titre, [
      { text: 'Non', style: 'cancel' },
      { text: 'Oui, annuler', style: 'destructive', onPress: () => {
        demandesDB.updateStatut(parseInt(id), 'annulee');
        annulationsDB.create({
          demande_id: parseInt(id),
          user_id:    user.id,
          role:       'expediteur',
          motif:      null,
          gratuite:   isGratuite ? 1 : 0,
        });
        if (demande.transporteur_id) {
          notifDB.create(
            demande.transporteur_id,
            `❌ L'expéditeur a annulé la demande ${demande.ville_depart} → ${demande.ville_arrivee}.`
          );
        }
        fetch();
      }},
    ]);
  };

  if (loading) return (
    <View style={s.center}><ActivityIndicator size="large" color={C.blue} /></View>
  );

  if (!demande) return (
    <View style={s.center}>
      <Text style={s.emptyTitle}>Demande introuvable</Text>
      <TouchableOpacity onPress={() => router.back()}>
        <Text style={{ color: C.blue, fontWeight: '700', marginTop: 12 }}>← Retour</Text>
      </TouchableOpacity>
    </View>
  );

  const st = STATUTS[demande.statut] || STATUTS.en_attente;
  const currentIdx = TIMELINE.indexOf(demande.statut);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.blue} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backTxt}>← Retour</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Détail de la demande</Text>
        <Text style={s.headerId}>#DZ{String(demande.id).padStart(4, '0')}</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>

        {/* Statut principal */}
        <View style={[s.statusCard, { borderColor: st.color, backgroundColor: st.bg }]}>
          <Text style={{ fontSize: 36, marginBottom: 6 }}>{st.icon}</Text>
          <Text style={[s.statusTitle, { color: st.color }]}>{st.label}</Text>
          <Text style={s.statusDesc}>{st.desc}</Text>
        </View>

        {/* Timeline */}
        {demande.statut !== 'annulee' && (
          <View style={s.card}>
            <Text style={s.cardTitle}>📊 Suivi de la livraison</Text>
            <View style={s.timeline}>
              {TIMELINE.map((step, i) => {
                const done    = i <= currentIdx;
                const current = i === currentIdx;
                const stepSt  = STATUTS[step];
                return (
                  <View key={step} style={s.timelineRow}>
                    <View style={s.timelineLeft}>
                      <View style={[s.timelineDot,
                        done && { backgroundColor: current ? stepSt.color : C.green },
                        !done && { backgroundColor: C.border },
                      ]}>
                        {done && <Text style={{ fontSize: 10, color: 'white' }}>
                          {current ? stepSt.icon : '✓'}
                        </Text>}
                      </View>
                      {i < TIMELINE.length - 1 && (
                        <View style={[s.timelineLine, i < currentIdx && { backgroundColor: C.green }]} />
                      )}
                    </View>
                    <View style={s.timelineRight}>
                      <Text style={[s.timelineLabel, !done && { color: C.muted }]}>
                        {stepSt.label}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Prix estimé ── */}
        {demande.prix_estime > 0 && (() => {
          const opts = (() => { try { return JSON.parse(demande.options_supplementaires || '{}'); } catch { return {}; } })();
          const { getDistanceKm } = require('../../src/utils/wilayas');
          const km  = getDistanceKm(demande.ville_depart, demande.ville_arrivee) || 50;
          const px  = calculerPrix(km, 'fourgon', { ...opts, nbActives: 0 });
          const ref = demande.prix_final || demande.prix_estime;
          return (
            <View style={ps.box}>
              <View style={ps.headerRow}>
                <Text style={ps.title}>💰 Prix estimé</Text>
                {demande.prix_final && (
                  <View style={ps.finalBadge}><Text style={ps.finalTxt}>Prix final confirmé</Text></View>
                )}
              </View>
              <Text style={ps.range}>
                {fmtPrix(demande.prix_estime)} – {fmtPrix(Math.round(demande.prix_estime * 1.15 / 25) * 25)}
              </Text>
              {demande.prix_final > 0 && (
                <Text style={ps.final}>✅ Prix final : {fmtPrix(demande.prix_final)}</Text>
              )}
              {demande.surge_coefficient > 1 && (
                <View style={ps.surgeChip}>
                  <Text style={ps.surgeTxt}>⚡ Surge actif : ×{demande.surge_coefficient.toFixed(2)}</Text>
                </View>
              )}
              <TouchableOpacity style={ps.detailBtn} onPress={() => setShowPrixDetail(v => !v)}>
                <Text style={ps.detailBtnTxt}>{showPrixDetail ? '▲' : '▼'} Voir le détail du calcul</Text>
              </TouchableOpacity>
              {showPrixDetail && (
                <View style={ps.detail}>
                  <Text style={ps.dLine}>📏 {px.detail.km} km × {px.detail.tarifKm} DA/km (fourgon)</Text>
                  <Text style={ps.dLine}>+ Prise en charge : {fmtPrix(px.detail.priseEnCharge)}</Text>
                  <Text style={ps.dLine}>= Base : {fmtPrix(px.detail.baseAvantSurge)}</Text>
                  {demande.surge_coefficient > 1 && (
                    <Text style={[ps.dLine, { color: '#F97316' }]}>⚡ Surge × {demande.surge_coefficient.toFixed(2)}</Text>
                  )}
                  {opts.etages > 0 && <Text style={ps.dLine}>🏢 {opts.etages} étage(s) : +{fmtPrix(opts.etages * 200)}</Text>}
                  {opts.aide    && <Text style={ps.dLine}>🤝 Aide chargement : +500 DA</Text>}
                  {opts.fragile && <Text style={ps.dLine}>📦 Fragile : +20%</Text>}
                  {opts.express && <Text style={ps.dLine}>⚡ Express : +40%</Text>}
                </View>
              )}
            </View>
          );
        })()}

        {/* Infos marchandise */}
        <View style={s.card}>
          <Text style={s.cardTitle}>📦 Marchandise</Text>
          <InfoRow icon={TYPES_ICON[demande.type_marchandise] || '📦'} label="Type" value={demande.type_marchandise} />
          {demande.poids && <InfoRow icon="⚖️" label="Poids" value={demande.poids} />}
          {demande.description && <InfoRow icon="📝" label="Description" value={demande.description} />}
        </View>

        {/* Itinéraire */}
        <View style={s.card}>
          <Text style={s.cardTitle}>📍 Itinéraire</Text>
          <View style={s.routeBlock}>
            <View style={s.routePoint}>
              <View style={[s.routeDot, { backgroundColor: C.green }]} />
              <View>
                <Text style={s.routePointLabel}>Départ</Text>
                <Text style={s.routeCity}>{demande.ville_depart}</Text>
              </View>
            </View>
            <View style={s.routeVertLine} />
            <View style={s.routePoint}>
              <View style={[s.routeDot, { backgroundColor: C.red }]} />
              <View>
                <Text style={s.routePointLabel}>Arrivée</Text>
                <Text style={s.routeCity}>{demande.ville_arrivee}</Text>
              </View>
            </View>
          </View>
          <InfoRow icon="📅" label="Date souhaitée" value={demande.date_souhaitee} />
          {(() => {
            const km = getDistanceKm(demande.ville_depart, demande.ville_arrivee);
            return km ? <InfoRow icon="📏" label="Distance estimée" value={`${fmtKm(km)} (vol d'oiseau ×1.25)`} /> : null;
          })()}
        </View>

        {/* ── Bouton Contacter le transporteur ── */}
        {(demande.statut === 'acceptee' || demande.statut === 'en_cours' || demande.statut === 'livree') && (
          <TouchableOpacity
            style={cs.contactBtn}
            onPress={() => router.push(`/chat/${demande.id}`)}
            activeOpacity={0.88}
          >
            <Text style={cs.contactBtnTxt}>
              💬 Contacter le transporteur
              {msgUnread > 0 && ` · ${msgUnread} non lu${msgUnread > 1 ? 's' : ''}`}
            </Text>
            {msgUnread > 0 && (
              <View style={cs.badge}><Text style={cs.badgeTxt}>{msgUnread > 9 ? '9+' : msgUnread}</Text></View>
            )}
          </TouchableOpacity>
        )}

        {/* Transporteur (si accepté) */}
        {demande.transporteur_nom && (
          <View style={[s.card, { borderColor: C.green, borderWidth: 2 }]}>
            <Text style={s.cardTitle}>🚛 Transporteur assigné</Text>
            <View style={s.transporteurBlock}>
              <View style={s.transporteurAvatar}>
                <Text style={{ fontSize: 20, fontWeight: '800', color: C.blue }}>
                  {demande.transporteur_nom?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.transporteurName}>{demande.transporteur_nom}</Text>
                {demande.transporteur_vehicule && (
                  <Text style={s.transporteurVeh}>
                    {VEH_ICON[demande.transporteur_vehicule] || '🚛'}{' '}
                    {demande.transporteur_vehicule}
                  </Text>
                )}
                <AnnulationsBadge count={transporteurAnnulations} />
              </View>
            </View>

            {demande.transporteur_tel && (
              <TouchableOpacity style={s.callBtn}
                onPress={() => Alert.alert('📞 Appel', `Numéro : ${demande.transporteur_tel}\n\nUtilise ton téléphone pour appeler le transporteur.`)}>
                <Text style={s.callBtnTxt}>📞 {demande.transporteur_tel}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Offres reçues (mode planifié) ── */}
        {demande.type_demande === 'planifie' && demande.statut === 'en_attente' && (
          <View style={s.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={s.cardTitle}>💬 Offres des transporteurs</Text>
              {offres.length > 0 && (
                <View style={{ backgroundColor: C.blueLight, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: C.blue }}>{offres.length} offre{offres.length > 1 ? 's' : ''}</Text>
                </View>
              )}
            </View>

            {offres.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                <Text style={{ fontSize: 36, marginBottom: 8 }}>⏳</Text>
                <Text style={{ fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 20 }}>
                  En attente des offres des transporteurs…{'\n'}Reviens dans quelques minutes.
                </Text>
              </View>
            ) : (
              offres.map((offre, i) => (
                <View key={offre.id} style={[offreStyles.card,
                  offre.statut === 'acceptee' && offreStyles.cardAccepted,
                  i > 0 && { marginTop: 10 }
                ]}>
                  <View style={offreStyles.header}>
                    <View style={offreStyles.avatar}>
                      <Text style={offreStyles.avatarTxt}>
                        {offre.transporteur_nom?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={offreStyles.nom}>{offre.transporteur_nom}</Text>
                      <Text style={offreStyles.veh}>🚛 {offre.transporteur_vehicule} · 📍 {offre.transporteur_wilaya}</Text>
                      <AnnulationsBadge count={offresAnnulations[offre.transporteur_id] ?? 0} />
                    </View>
                    {offre.statut === 'acceptee' && (
                      <View style={offreStyles.acceptedBadge}><Text style={offreStyles.acceptedTxt}>✅ Acceptée</Text></View>
                    )}
                  </View>

                  {offre.prix_propose ? (
                    <Text style={offreStyles.prix}>{offre.prix_propose.toLocaleString()} DA</Text>
                  ) : (
                    <Text style={[offreStyles.prix, { color: C.muted }]}>Prix à négocier</Text>
                  )}

                  {offre.message ? (
                    <Text style={offreStyles.message}>"{offre.message}"</Text>
                  ) : null}

                  {/* Contre-proposition en cours */}
                  {offre.contre_prix > 0 && offre.dernier_negociateur === 'expediteur' && (
                    <View style={offreStyles.contreBadge}>
                      <Text style={offreStyles.contreTxt}>
                        💬 Ta contre-proposition : {fmtPrix(offre.contre_prix)}
                        {'\n'}En attente de réponse du transporteur…
                      </Text>
                    </View>
                  )}
                  {offre.contre_prix > 0 && offre.dernier_negociateur === 'transporteur' && (
                    <View style={[offreStyles.contreBadge, { backgroundColor: '#EBF5FF', borderColor: '#BFDBFE' }]}>
                      <Text style={[offreStyles.contreTxt, { color: '#1A56DB' }]}>
                        🔄 Contre-offre du transporteur : {fmtPrix(offre.contre_prix)}
                      </Text>
                    </View>
                  )}

                  {demande.statut === 'en_attente' && offre.statut === 'en_attente' && (
                    <>
                      <TouchableOpacity
                        style={[offreStyles.acceptBtn, accepting === offre.id && { opacity: 0.7 }]}
                        disabled={accepting === offre.id}
                        onPress={() => {
                          const prixDisplay = offre.contre_prix
                            ? fmtPrix(offre.contre_prix)
                            : offre.prix_propose ? fmtPrix(offre.prix_propose) : 'Prix à négocier';
                          Alert.alert(
                            'Accepter cette offre ?',
                            `${offre.transporteur_nom} — ${prixDisplay}`,
                            [
                              { text: 'Non', style: 'cancel' },
                              { text: 'Accepter ✅', onPress: async () => {
                                setAccepting(offre.id);
                                try {
                                  const prixFinal = offre.contre_prix || offre.prix_propose || null;
                                  offresDB.accepter(offre.id, demande.id, offre.transporteur_id);
                                  if (prixFinal) demandesDB.setPrixFinal(demande.id, prixFinal);
                                  notifDB.create(offre.transporteur_id, `✅ Ton offre pour ${demande.ville_depart} → ${demande.ville_arrivee} a été acceptée !`);
                                  localNotif(user.id, `✅ Tu as accepté l'offre de ${offre.transporteur_nom} !`);
                                  fetch();
                                } catch (e) { Alert.alert('Erreur', e.message); }
                                finally { setAccepting(null); }
                              }},
                            ]
                          );
                        }}
                      >
                        {accepting === offre.id
                          ? <ActivityIndicator color="white" size="small" />
                          : <Text style={offreStyles.acceptBtnTxt}>✅ Accepter cette offre</Text>
                        }
                      </TouchableOpacity>

                      {/* Contre-proposer (max 4 échanges totaux, 2 chacun) */}
                      {(offre.nb_contre_propositions || 0) < 4 &&
                       offre.dernier_negociateur !== 'expediteur' && (
                        contreForm === offre.id ? (
                          <View style={offreStyles.contreForm}>
                            <TextInput
                              style={offreStyles.contreInput}
                              placeholder="Ton prix en DA…"
                              placeholderTextColor="#94A3B8"
                              keyboardType="numeric"
                              value={contrePrix}
                              onChangeText={setContrePrix}
                            />
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                              <TouchableOpacity
                                style={[offreStyles.contreSendBtn, !contrePrix && { opacity: 0.5 }]}
                                disabled={!contrePrix}
                                onPress={() => {
                                  const prix = parseFloat(contrePrix);
                                  if (!prix || prix <= 0) return;
                                  offresDB.contreProposer(offre.id, prix, 'expediteur');
                                  notifDB.create(offre.transporteur_id,
                                    `💬 ${user.nom} te fait une contre-proposition : ${fmtPrix(prix)} pour ${demande.ville_depart} → ${demande.ville_arrivee}`
                                  );
                                  setContreForm(null); setContrePrix(''); fetch();
                                }}
                              >
                                <Text style={offreStyles.contreSendTxt}>Envoyer</Text>
                              </TouchableOpacity>
                              <TouchableOpacity style={offreStyles.contreAbandon} onPress={() => { setContreForm(null); setContrePrix(''); }}>
                                <Text style={{ color: '#64748B', fontWeight: '600' }}>Annuler</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ) : (
                          <TouchableOpacity
                            style={offreStyles.contreBtn}
                            onPress={() => { setContreForm(offre.id); setContrePrix(''); }}
                          >
                            <Text style={offreStyles.contreBtnTxt}>
                              💬 Contre-proposer
                              {offre.nb_contre_propositions > 0 && ` (${2 - Math.ceil(offre.nb_contre_propositions/2)} restante${2 - Math.ceil(offre.nb_contre_propositions/2) > 1 ? 's' : ''})`}
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

        {/* Transporteur simulé (mode maintenant accepté) */}
        {demande.type_demande === 'maintenant' && demande.transporteur_simule && (() => {
          try {
            const t = JSON.parse(demande.transporteur_simule);
            return (
              <View style={[s.card, { borderColor: C.green, borderWidth: 2 }]}>
                <Text style={s.cardTitle}>🚛 Transporteur (mode Maintenant)</Text>
                <Text style={{ fontSize: 16, fontWeight: '800', color: C.text, marginBottom: 4 }}>{t.nom}</Text>
                <Text style={{ color: C.muted, marginBottom: 10 }}>⭐ {t.rating} · {t.vehicule_label}</Text>
                <View style={{ backgroundColor: C.greenLight, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#BBF7D0' }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: C.green, marginBottom: 4 }}>📞 Numéro de téléphone</Text>
                  <Text style={{ fontSize: 20, fontWeight: '900', color: C.green }}>{t.telephone}</Text>
                </View>
              </View>
            );
          } catch { return null; }
        })()}

        {/* ── Timer annulation gratuite ── */}
        {demande.statut === 'acceptee' && timeLeft !== null && (
          <View style={[s.timerBanner, timeLeft > 0 ? s.timerOrange : s.timerRed]}>
            {timeLeft > 0 ? (
              <Text style={s.timerTxt}>
                ⏱️ Annulation gratuite encore possible :{' '}
                {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
              </Text>
            ) : (
              <Text style={[s.timerTxt, { color: C.red }]}>
                ⚠️ Délai d'annulation gratuite dépassé
              </Text>
            )}
          </View>
        )}

        {/* ── Bouton annuler (en_attente ou acceptee) ── */}
        {(demande.statut === 'en_attente' || demande.statut === 'acceptee') && (
          <TouchableOpacity
            style={[
              s.cancelBtn,
              demande.statut === 'acceptee' && timeLeft === 0 && s.cancelBtnRed,
            ]}
            onPress={annuler}
          >
            <Text style={[
              s.cancelBtnTxt,
              demande.statut === 'acceptee' && timeLeft === 0 && { color: C.red },
            ]}>
              {demande.statut === 'acceptee' && timeLeft !== null && timeLeft > 0
                ? '🟠 Annuler gratuitement'
                : '❌ Annuler cette demande'}
            </Text>
          </TouchableOpacity>
        )}

      </ScrollView>
    </View>
  );
}

function AnnulationsBadge({ count }) {
  if (count <= 2) return null;
  const rouge = count > 5;
  return (
    <View style={[ab.badge, rouge ? ab.rouge : ab.orange]}>
      <Text style={[ab.txt, rouge ? ab.rougeTxt : ab.orangeTxt]}>
        {count} annulation{count > 1 ? 's' : ''}
        {rouge ? ' · Transporteur peu fiable' : ''}
      </Text>
    </View>
  );
}

const ab = StyleSheet.create({
  badge:     { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3, alignSelf: 'flex-start', marginTop: 5, borderWidth: 1 },
  orange:    { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' },
  rouge:     { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  txt:       { fontSize: 11, fontWeight: '700' },
  orangeTxt: { color: '#F97316' },
  rougeTxt:  { color: '#DC2626' },
});

function InfoRow({ icon, label, value }) {
  return (
    <View style={ir.root}>
      <Text style={ir.icon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={ir.label}>{label}</Text>
        <Text style={ir.value}>{value}</Text>
      </View>
    </View>
  );
}
const ir = StyleSheet.create({
  root:  { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  icon:  { fontSize: 20, width: 28 },
  label: { fontSize: 11, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.4 },
  value: { fontSize: 14, fontWeight: '600', color: C.text, marginTop: 2 },
});

const s = StyleSheet.create({
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  emptyTitle:  { fontSize: 18, fontWeight: '700', color: C.text },

  header:      { backgroundColor: C.blue, paddingTop: Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight || 24) + 12, paddingBottom: 18, paddingHorizontal: 20 },
  backBtn:     { marginBottom: 6 },
  backTxt:     { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '600' },
  headerTitle: { color: 'white', fontSize: 22, fontWeight: '900' },
  headerId:    { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 3 },

  card:        { backgroundColor: C.white, borderRadius: 16, padding: 18, elevation: 1, borderWidth: 1, borderColor: C.border },
  cardTitle:   { fontSize: 15, fontWeight: '800', color: C.text, marginBottom: 14 },

  statusCard:  { borderRadius: 20, padding: 24, alignItems: 'center', borderWidth: 2 },
  statusTitle: { fontSize: 22, fontWeight: '900', marginBottom: 6 },
  statusDesc:  { fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 20 },

  timeline:    { gap: 0 },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  timelineLeft:{ alignItems: 'center', width: 28 },
  timelineDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  timelineLine:{ width: 2, height: 32, backgroundColor: C.border, marginTop: 2 },
  timelineRight: { paddingTop: 4, paddingBottom: 28 },
  timelineLabel: { fontSize: 14, fontWeight: '700', color: C.text },

  routeBlock:  { marginBottom: 12 },
  routePoint:  { flexDirection: 'row', alignItems: 'center', gap: 14 },
  routeDot:    { width: 14, height: 14, borderRadius: 7 },
  routeVertLine: { width: 2, height: 20, backgroundColor: C.border, marginLeft: 6 },
  routePointLabel: { fontSize: 11, fontWeight: '700', color: C.muted, textTransform: 'uppercase' },
  routeCity:   { fontSize: 16, fontWeight: '800', color: C.text },

  transporteurBlock: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  transporteurAvatar:{ width: 48, height: 48, borderRadius: 24, backgroundColor: C.blueLight, alignItems: 'center', justifyContent: 'center' },
  transporteurName:  { fontSize: 16, fontWeight: '800', color: C.text },
  transporteurVeh:   { fontSize: 13, color: C.muted, marginTop: 3 },
  callBtn:     { backgroundColor: C.greenLight, borderRadius: 12, paddingVertical: 13, alignItems: 'center', borderWidth: 1.5, borderColor: '#BBF7D0' },
  callBtnTxt:  { fontSize: 15, fontWeight: '700', color: C.green },

  cancelBtn:    { backgroundColor: C.redLight, borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderColor: '#FECACA' },
});

const cs = StyleSheet.create({
  contactBtn:   { backgroundColor: '#F0FDF4', borderRadius: 14, paddingVertical: 15, alignItems: 'center', borderWidth: 2, borderColor: '#16A34A', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  contactBtnTxt:{ fontSize: 15, fontWeight: '800', color: '#16A34A' },
  badge:        { backgroundColor: '#DC2626', borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeTxt:     { color: 'white', fontSize: 11, fontWeight: '900' },

  // (placeholder — keeps the old s StyleSheet reference clean)
  _dummy:       {},
  cancelBtnTxt: { fontSize: 15, fontWeight: '700', color: C.red },
  cancelBtnRed: { backgroundColor: '#FEF2F2', borderColor: C.red, borderWidth: 2 },

  timerBanner:  { borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center', borderWidth: 1.5 },
  timerOrange:  { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' },
  timerRed:     { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  timerTxt:     { fontSize: 14, fontWeight: '800', color: C.orange },
});

const offreStyles = StyleSheet.create({
  card:          { backgroundColor: C.bg, borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: C.border },
  cardAccepted:  { borderColor: C.green, backgroundColor: C.greenLight },
  header:        { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  avatar:        { width: 42, height: 42, borderRadius: 21, backgroundColor: C.blueLight, alignItems: 'center', justifyContent: 'center' },
  avatarTxt:     { fontSize: 14, fontWeight: '900', color: C.blue },
  nom:           { fontSize: 15, fontWeight: '800', color: C.text },
  veh:           { fontSize: 12, color: C.muted, marginTop: 2 },
  acceptedBadge: { backgroundColor: C.greenLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  acceptedTxt:   { fontSize: 12, fontWeight: '700', color: C.green },
  prix:          { fontSize: 22, fontWeight: '900', color: C.blue, marginBottom: 6 },
  message:       { fontSize: 13, color: C.muted, fontStyle: 'italic', marginBottom: 10, lineHeight: 19 },
  acceptBtn:     { backgroundColor: C.blue, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  acceptBtnTxt:  { color: 'white', fontSize: 14, fontWeight: '700' },
  contreBadge:   { backgroundColor: '#FFF7ED', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#FED7AA', marginBottom: 6 },
  contreTxt:     { fontSize: 12, fontWeight: '700', color: C.orange, lineHeight: 18 },
  contreBtn:     { borderWidth: 1.5, borderColor: C.orange, borderRadius: 12, paddingVertical: 10, alignItems: 'center', marginTop: 6 },
  contreBtnTxt:  { fontSize: 13, fontWeight: '700', color: C.orange },
  contreForm:    { marginTop: 8, gap: 8 },
  contreInput:   { backgroundColor: C.white, borderWidth: 1.5, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: C.text },
  contreSendBtn: { flex: 1, backgroundColor: C.orange, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  contreSendTxt: { color: 'white', fontSize: 14, fontWeight: '700' },
  contreAbandon: { paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
});

// ── Styles section prix ──────────────────────────────────────
const ps = StyleSheet.create({
  box:        { backgroundColor: '#F0FDF4', borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: '#BBF7D0' },
  headerRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  title:      { fontSize: 14, fontWeight: '900', color: '#16A34A', flex: 1 },
  finalBadge: { backgroundColor: '#16A34A', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  finalTxt:   { fontSize: 11, fontWeight: '700', color: 'white' },
  range:      { fontSize: 22, fontWeight: '900', color: '#1A56DB', marginBottom: 4 },
  final:      { fontSize: 15, fontWeight: '700', color: '#16A34A', marginBottom: 6 },
  surgeChip:  { backgroundColor: '#FFF7ED', borderRadius: 10, padding: 7, borderWidth: 1, borderColor: '#FED7AA', marginBottom: 6 },
  surgeTxt:   { fontSize: 12, fontWeight: '700', color: '#F97316' },
  detailBtn:  { alignItems: 'center', paddingTop: 8 },
  detailBtnTxt:{ fontSize: 12, fontWeight: '700', color: '#16A34A' },
  detail:     { backgroundColor: '#DCFCE7', borderRadius: 10, padding: 10, marginTop: 8 },
  dLine:      { fontSize: 12, color: '#374151', marginBottom: 3 },
});
