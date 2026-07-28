export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      acertos: {
        Row: {
          created_at: string
          oferta_id: string
          quantidade_vendida: number
          registrado_em: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          oferta_id: string
          quantidade_vendida?: number
          registrado_em?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          oferta_id?: string
          quantidade_vendida?: number
          registrado_em?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "acertos_oferta_id_fkey"
            columns: ["oferta_id"]
            isOneToOne: true
            referencedRelation: "ofertas"
            referencedColumns: ["id"]
          },
        ]
      }
      campanhas: {
        Row: {
          clube_sumel: boolean
          created_at: string
          data_final: string | null
          data_inicial: string | null
          descricao: string
          filiais: Json
          id: string
          materiais: Json
          nome: string
          status: string
          updated_at: string
        }
        Insert: {
          clube_sumel?: boolean
          created_at?: string
          data_final?: string | null
          data_inicial?: string | null
          descricao?: string
          filiais?: Json
          id?: string
          materiais?: Json
          nome: string
          status?: string
          updated_at?: string
        }
        Update: {
          clube_sumel?: boolean
          created_at?: string
          data_final?: string | null
          data_inicial?: string | null
          descricao?: string
          filiais?: Json
          id?: string
          materiais?: Json
          nome?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      ofertas: {
        Row: {
          campanha_id: string
          categoria: string
          clube_sumel: boolean
          codigo: string
          corredor: string
          created_at: string
          custo: number
          data_final: string | null
          data_inicial: string | null
          descricao: string
          estoque: number
          filiais: Json
          fornecedor: string
          gtin: string
          id: string
          margem: number
          preco_normal: number
          preco_promocional: number
          sellout_fornecedor: string
          sellout_obs: string
          sellout_tem_verba: boolean
          sellout_valor: number
          status: string
          updated_at: string
        }
        Insert: {
          campanha_id: string
          categoria?: string
          clube_sumel?: boolean
          codigo?: string
          corredor?: string
          created_at?: string
          custo?: number
          data_final?: string | null
          data_inicial?: string | null
          descricao?: string
          estoque?: number
          filiais?: Json
          fornecedor?: string
          gtin?: string
          id?: string
          margem?: number
          preco_normal?: number
          preco_promocional?: number
          sellout_fornecedor?: string
          sellout_obs?: string
          sellout_tem_verba?: boolean
          sellout_valor?: number
          status?: string
          updated_at?: string
        }
        Update: {
          campanha_id?: string
          categoria?: string
          clube_sumel?: boolean
          codigo?: string
          corredor?: string
          created_at?: string
          custo?: number
          data_final?: string | null
          data_inicial?: string | null
          descricao?: string
          estoque?: number
          filiais?: Json
          fornecedor?: string
          gtin?: string
          id?: string
          margem?: number
          preco_normal?: number
          preco_promocional?: number
          sellout_fornecedor?: string
          sellout_obs?: string
          sellout_tem_verba?: boolean
          sellout_valor?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ofertas_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
        ]
      }
      preferencias_colunas: {
        Row: {
          colunas: Json
          created_at: string
          id: string
          tabela: string
          updated_at: string
          usuario_id: string
        }
        Insert: {
          colunas?: Json
          created_at?: string
          id?: string
          tabela: string
          updated_at?: string
          usuario_id: string
        }
        Update: {
          colunas?: Json
          created_at?: string
          id?: string
          tabela?: string
          updated_at?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "preferencias_colunas_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      produto_importacoes: {
        Row: {
          arquivo: string | null
          atualizados: number
          created_at: string
          duracao_ms: number
          erros: number
          id: string
          novos: number
          processados: number
          sem_barras: number
          usuario: string | null
        }
        Insert: {
          arquivo?: string | null
          atualizados?: number
          created_at?: string
          duracao_ms?: number
          erros?: number
          id?: string
          novos?: number
          processados?: number
          sem_barras?: number
          usuario?: string | null
        }
        Update: {
          arquivo?: string | null
          atualizados?: number
          created_at?: string
          duracao_ms?: number
          erros?: number
          id?: string
          novos?: number
          processados?: number
          sem_barras?: number
          usuario?: string | null
        }
        Relationships: []
      }
      produtos: {
        Row: {
          ativo: boolean
          codigo: string | null
          created_at: string
          custo: number
          descricao: string
          gtin: string | null
          id: string
          preco_venda: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo?: string | null
          created_at?: string
          custo?: number
          descricao: string
          gtin?: string | null
          id?: string
          preco_venda?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo?: string | null
          created_at?: string
          custo?: number
          descricao?: string
          gtin?: string | null
          id?: string
          preco_venda?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string
          permissions: Json
          read_only: boolean
          status: string
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          id: string
          name?: string
          notes?: string
          permissions?: Json
          read_only?: boolean
          status?: string
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string
          permissions?: Json
          read_only?: boolean
          status?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_write: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_read_only: { Args: { _user_id: string }; Returns: boolean }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
