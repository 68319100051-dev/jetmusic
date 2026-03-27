'use client';
import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import styles from './Modal.module.css';
import { X } from 'lucide-react';

interface ModalOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  placeholder?: string;
  defaultValue?: string;
}

interface ModalContextType {
  confirm: (options: ModalOptions) => Promise<boolean>;
  prompt: (options: ModalOptions) => Promise<string | null>;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [activeModal, setActiveModal] = useState<{
    id: string;
    type: 'confirm' | 'prompt';
    options: ModalOptions;
    resolve: (value: any) => void;
  } | null>(null);

  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const confirm = useCallback((options: ModalOptions) => {
    return new Promise<boolean>((resolve) => {
      setActiveModal({ id: Math.random().toString(), type: 'confirm', options, resolve });
    });
  }, []);

  const prompt = useCallback((options: ModalOptions) => {
    setInputValue(options.defaultValue || '');
    return new Promise<string | null>((resolve) => {
      setActiveModal({ id: Math.random().toString(), type: 'prompt', options, resolve });
    });
  }, []);

  const handleClose = useCallback(() => {
    if (activeModal) {
      activeModal.resolve(activeModal.type === 'confirm' ? false : null);
      setActiveModal(null);
    }
  }, [activeModal]);

  const handleConfirm = useCallback(() => {
    if (activeModal) {
      activeModal.resolve(activeModal.type === 'confirm' ? true : inputValue);
      setActiveModal(null);
    }
  }, [activeModal, inputValue]);

  useEffect(() => {
    if (activeModal?.type === 'prompt' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [activeModal]);

  return (
    <ModalContext.Provider value={{ confirm, prompt }}>
      {children}
      {activeModal && (
        <div className={styles.overlay} onClick={handleClose}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.header}>
              <h3>{activeModal.options.title}</h3>
              <button className={styles.closeBtn} onClick={handleClose}><X size={20} /></button>
            </div>
            <div className={styles.content}>
              <p>{activeModal.options.message}</p>
              {activeModal.type === 'prompt' && (
                <input
                  ref={inputRef}
                  type="text"
                  className={styles.input}
                  placeholder={activeModal.options.placeholder || ''}
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleConfirm();
                    if (e.key === 'Escape') handleClose();
                  }}
                />
              )}
            </div>
            <div className={styles.actions}>
              <button className={styles.cancelBtn} onClick={handleClose}>
                {activeModal.options.cancelLabel || 'ยกเลิก'}
              </button>
              <button className={styles.confirmBtn} onClick={handleConfirm}>
                {activeModal.options.confirmLabel || (activeModal.type === 'confirm' ? 'ตกลง' : 'สร้าง')}
              </button>
            </div>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (context === undefined) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
}
