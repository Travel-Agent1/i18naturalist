class ListedTaxaController < ApplicationController
  before_filter :login_required, :except => [:show]
  before_filter :load_listed_taxon, :except => [:index, :create]
  cache_sweeper :listed_taxon_sweeper, :only => [:create, :update, :destroy]

  def index
    redirect_to lists_path
  end
  
  def show
  end
  
  def create
    if params[:listed_taxon]
      @list = List.find_by_id(params[:listed_taxon][:list_id])
      @place = Place.find_by_id(params[:listed_taxon][:place_id]) if params[:listed_taxon][:place_id]
      @taxon = Taxon.find_by_id(params[:listed_taxon][:taxon_id])
    else
      @list = List.find_by_id(params[:list_id])
      @place = Place.find_by_id(params[:place_id])
      @taxon = Taxon.find_by_id(params[:taxon_id])
    end
    @list ||= @place.check_list if @place
    
    unless @list && @list.editable_by?(current_user)
      flash[:notice] = "Sorry, you don't have permission to add to this list."
      return redirect_to lists_path
    end
    
    @listed_taxon = @list.add_taxon(@taxon, :user_id => current_user.id) if @taxon
    
    respond_to do |format|
      format.html do
        if @listed_taxon.valid?
          flash[:notice] = "List udpated!"
        else
          flash[:error] = "D'oh, there was a problem updating your list: " +
                          @listed_taxon.errors.full_messages.join(', ')
        end
        return redirect_to lists_path if @listed_taxon.list_id.nil?
        redirect_to list_path(@listed_taxon.list)
      end
      format.json do
        partial = 'lists/' + (params[:partial] || 'listed_taxon') + ".html.erb"
        if @listed_taxon.valid?
          render(:json => {
            :instance => @listed_taxon,
            :extra => {
              :taxon => @listed_taxon.taxon,
              :iconic_taxon => @listed_taxon.taxon.iconic_taxon,
              :place => @listed_taxon.place
            },
            :html => render_to_string(
              :partial => partial, 
              :object => @listed_taxon,
              :locals => {:listed_taxon => @listed_taxon, :seenit => true}
            )
          })
        else
          render(
            :json => {
              :object => @listed_taxon,
              :errors => @listed_taxon.errors,
              :full_messages => @listed_taxon.errors.full_messages.to_sentence
            },
            :status => :unprocessable_entity,
            :status_text => @listed_taxon.errors.full_messages.join(', ')
          )
        end
      end
    end
  end
  
  def update
    unless @list.listed_taxa_editable_by?(current_user)
      flash[:error] = "You don't have permission to edit listed taxa on this list"
      redirect_to :back
      return
    end
    
    listed_taxon = params[:listed_taxon] || {}
    if @listed_taxon.update_attributes(listed_taxon.merge(:updater_id => current_user.id))
      flash[:notice] = "Listed taxon updated"
      redirect_to :back
    else
      flash[:error] = "There were problems updating that listed taxon: #{@listed_taxon.errors.full_messages.to_sentence}"
      render :action => :show
    end
  end

  def destroy
    @listed_taxon = ListedTaxon.find_by_id(params[:id], :include => :list)
    
    unless @listed_taxon && @listed_taxon.list.editable_by?(current_user)
      flash[:notice] = "Sorry, you don't have permission to delete from " + 
        "this list."
      return redirect_to lists_path
    end
    
    @listed_taxon.destroy
    
    respond_to do |format|
      format.html do
        flash[:notice] = "Taxon removed from list."
        return redirect_to(@listed_taxon.list)
      end
      format.json do
        if params[:partial]
          partial = "lists/#{params[:partial]}.html.erb"
          return render(
            :json => {
              :object => @listed_taxon,
              :html => render_to_string(:partial => partial, :locals => {
                :listed_taxon => @listed_taxon
              })
            }
          )
        else
          return render(:json => @listed_taxon)
        end
      end
    end
  end
  
  private
  
  def load_listed_taxon
    unless @listed_taxon = ListedTaxon.find_by_id(params[:id], :include => [:list, :taxon, :user])
      flash[:notice] = "That listed taxon doesn't exist."
      redirect_to :back
      return
    end
    @list = @listed_taxon.list
    @taxon = @listed_taxon.taxon
  end
end
