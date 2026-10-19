import { useState } from "react";
import { Pencil, Plus, Users } from "lucide-react";
import { Empty, ErrorState, Field, Loading, Modal, PageHead, Segmented, Switch, useToast } from "../../components/ui";
import { api } from "../../lib/api";
import { ago, ROLE_LABEL } from "../../lib/format";
import { useApi } from "../../lib/hooks";
import { useSession } from "../../lib/session";

interface StaffRow {
  id: string;
  name: string;
  login: string;
  role: "owner" | "manager" | "staff";
  active: number;
  last_login_at: number | null;
}

export function StaffPage() {
  const { user } = useSession();
  const { data, error, loading, reload } = useApi<{ staff: StaffRow[]; limit: number }>("/api/store/staff");
  const [edit, setEdit] = useState<Partial<StaffRow> | null>(null);
  const activeCount = data?.staff.filter((s) => s.role !== "owner" && s.active).length ?? 0;

  return (
    <>
      <PageHead
        title="Karyawan"
        sub={data ? `${activeCount} dari ${data.limit} akun karyawan aktif terpakai.` : undefined}
        actions={
          <button className="btn btn-primary" onClick={() => setEdit({ role: "staff", active: 1 })} disabled={!!data && activeCount >= data.limit}>
            <Plus /> Tambah akun
          </button>
        }
      />
      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="panel">
          <h3>Manajemen (pemilik & manajer)</h3>
          <p className="small muted" style={{ marginTop: 6 }}>Semua akses: laporan penjualan, ubah menu & harga, meja & QR, stok, karyawan, dan pengaturan toko.</p>
        </div>
        <div className="panel">
          <h3>Karyawan</h3>
          <p className="small muted" style={{ marginTop: 6 }}>Untuk kasir, pelayan, dan dapur: terima pesanan, catat pesanan di kasir, terima pembayaran, tandai menu habis. Tidak bisa melihat laporan atau mengubah harga.</p>
        </div>
      </div>
      {error ? (
        <ErrorState message={error.message} onRetry={() => reload()} />
      ) : loading || !data ? (
        <Loading rows={3} height={56} />
      ) : data.staff.length <= 1 ? (
        <div className="panel">
          <Empty icon={<Users aria-hidden="true" />} title="Baru ada akun kamu" action={<button className="btn btn-primary" onClick={() => setEdit({ role: "staff", active: 1 })}><Plus /> Tambah akun karyawan</button>}>
            Buat akun terpisah untuk tiap karyawan, supaya terlihat siapa yang mencatat dan menerima pembayaran.
          </Empty>
        </div>
      ) : (
        <div className="panel flush">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Login</th>
                  <th>Peran</th>
                  <th>Terakhir masuk</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.staff.map((s) => (
                  <tr key={s.id} style={!s.active ? { opacity: 0.6 } : undefined}>
                    <td className="strong">
                      {s.name}
                      {s.id === user?.id && <span className="muted small"> (kamu)</span>}
                    </td>
                    <td className="small">{s.login}</td>
                    <td>
                      <span className={`badge ${s.role === "staff" ? "" : "badge-ok"}`}>{ROLE_LABEL[s.role]}</span>
                      {!s.active && <span className="badge badge-warn" style={{ marginLeft: 4 }}>Nonaktif</span>}
                    </td>
                    <td className="small muted nowrap">{s.last_login_at ? ago(s.last_login_at) : "Belum pernah"}</td>
                    <td className="r">
                      {s.role !== "owner" && (user?.role === "owner" || s.role === "staff") && (
                        <button className="icon-btn" aria-label={`Ubah akun ${s.name}`} onClick={() => setEdit(s)}>
                          <Pencil />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {edit && <StaffEditor row={edit} canManager={user?.role === "owner"} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(true); }} />}
    </>
  );
}

function StaffEditor({ row, canManager, onClose, onSaved }: { row: Partial<StaffRow>; canManager: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const isNew = !row.id;
  const [name, setName] = useState(row.name ?? "");
  const [login, setLogin] = useState(row.login ?? "");
  const [role, setRole] = useState<"staff" | "manager">((row.role as "staff" | "manager") ?? "staff");
  const [password, setPassword] = useState("");
  const [active, setActive] = useState(row.active !== 0);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const body = { name, login, role, active, ...(password ? { password } : {}) };
    try {
      if (isNew) await api.post("/api/store/staff", body);
      else await api.put(`/api/store/staff/${row.id}`, body);
      toast(isNew ? `Akun ${name} dibuat. Berikan username dan kata sandinya.` : "Akun disimpan.");
      onSaved();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? "Tambah akun" : `Ubah akun ${row.name}`}
      footer={
        <>
          <button className="btn" onClick={onClose}>Batal</button>
          <button className="btn btn-primary" disabled={busy || !name.trim() || !login.trim() || (isNew && password.length < 6)} onClick={save}>
            {isNew ? "Buat akun" : "Simpan"}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Nama" htmlFor="st-name">
          <input id="st-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Mis. Rina" autoFocus />
        </Field>
        <Field label="Username untuk masuk" htmlFor="st-login" hint="Huruf kecil tanpa spasi. Harus unik di seluruh Pesan.in, jadi tambahkan nama toko, mis. rina.warungku">
          <input id="st-login" className="input" value={login} onChange={(e) => setLogin(e.target.value.toLowerCase().replace(/\s/g, ""))} maxLength={120} autoCapitalize="none" autoComplete="off" />
        </Field>
        {canManager && (
          <div className="field">
            <span className="field-label">Peran</span>
            <Segmented label="Peran" value={role} onChange={setRole} options={[{ value: "staff", label: "Karyawan" }, { value: "manager", label: "Manajer" }]} />
            <span className="hint">{role === "manager" ? "Manajer bisa melihat laporan dan mengubah semua pengaturan toko." : "Karyawan tidak bisa melihat laporan atau mengubah harga."}</span>
          </div>
        )}
        <Field label={isNew ? "Kata sandi" : "Kata sandi baru (kosongkan kalau tidak diganti)"} htmlFor="st-pw" hint="Minimal 6 karakter.">
          <input id="st-pw" className="input" type="text" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </Field>
        {!isNew && <Switch checked={active} onChange={setActive} label="Akun aktif" hint="Nonaktifkan kalau karyawan sudah berhenti. Ia langsung keluar dari semua perangkat." />}
      </div>
    </Modal>
  );
}
